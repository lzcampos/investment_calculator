import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, '..', 'data', 'stocks.sqlite3');
const db = new Database(DB_PATH, { readonly: false });
db.pragma('foreign_keys = ON');

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 1) search stock_info
// Query params: q (string), limit (int, default 20)
app.get('/api/stock_infos/search', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  if (!q) return res.json({ items: [] });

  // Search across symbol, regularMarketPrice, longName, shortName, firstTradeDate
  // - For numeric fields, attempt number parse
  const like = `%${q}%`;
  const num = Number(q);
  const isNum = Number.isFinite(num);

  const rows = db.prepare(`
    SELECT id, currency, symbol, exchangeName, fullExchangeName, instrumentType,
           firstTradeDate, timezone, exchangeTimezoneName, regularMarketPrice,
           longName, shortName
    FROM stock_infos
    WHERE (
      symbol LIKE @like OR
      longName LIKE @like OR
      shortName LIKE @like
    )
    ${isNum ? 'OR regularMarketPrice = @num OR firstTradeDate = @num' : ''}
    ORDER BY symbol ASC
    LIMIT @limit
  `).all({ like, num, limit });

  return res.json({ items: rows });
});

// Helpers for calculation
function getStockById(stockId) {
  return db.prepare('SELECT * FROM stock_infos WHERE id = ?').get(stockId);
}

function getMonthlyPricesFrom(stockId, startTs) {
  return db.prepare(`
    SELECT timestamp, close_price
    FROM stock_historical_price
    WHERE stock_id = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(stockId, startTs);
}

function getDividendsFrom(stockId, startTs) {
  return db.prepare(`
    SELECT announce_timestamp, payment_timestamp, amount
    FROM stock_historical_dividend_yield
    WHERE stock_id = ? AND announce_timestamp >= ?
    ORDER BY announce_timestamp ASC
  `).all(stockId, startTs);
}

// 2) calculate_investment
app.post('/api/calculate_investment', (req, res) => {
  try {
    const {
      stock_id,
      initial_investment,
      investment_start,
      monthly_investment,
      reinvest_dividends,
    } = req.body || {};

    if (!stock_id || !Number.isFinite(Number(stock_id))) {
      return res.status(400).json({ error: 'stock_id is required' });
    }
    const startTs = Number(investment_start);
    if (!Number.isFinite(startTs)) {
      return res.status(400).json({ error: 'investment_start must be epoch seconds' });
    }
    const initCash = Number(initial_investment) || 0;
    const monthlyCash = Number(monthly_investment) || 0;
    const reinvest = Boolean(reinvest_dividends);

    const stock = getStockById(stock_id);
    if (!stock) return res.status(404).json({ error: 'stock not found' });

    // Ensure start is not before earliest available timestamp
    const minRow = db.prepare('SELECT MIN(timestamp) AS minTs FROM stock_historical_price WHERE stock_id = ?').get(stock_id);
    const earliestTs = Number(minRow?.minTs) || null;
    if (!earliestTs) return res.status(400).json({ error: 'no_price_data_for_stock' });
    if (startTs < earliestTs) {
      return res.status(400).json({
        error: 'investment_start_before_earliest_available',
        earliest_investment_start: earliestTs,
      });
    }

    const prices = getMonthlyPricesFrom(stock_id, startTs);
    if (prices.length === 0) return res.status(400).json({ error: 'no price data from start date' });
    const dividends = getDividendsFrom(stock_id, startTs);

    let cash = 0;
    let shares = 0;
    let totalDividends = 0;
    let investment = 0;
    const ops = [];

    const applyBuy = (label, amount, price, ts) => {
      cash += amount;
      investment += amount;
      let bought = 0;
      if (price && price > 0) {
        bought = Math.floor(cash / price);
      }
      const cost = bought * (price || 0);
      cash -= cost;
      shares += bought;
      ops.push({
        description: label,
        timestamp: ts,
        available_total: Number(cash.toFixed(2)),
        total_investment: Number(investment.toFixed(2)),
        price_used: price,
        shares_bought: bought,
        total_shares: shares,
      });
    };

    // Initial investment at first available price on/after start
    const firstPrice = prices[0]?.close_price || 0;
    applyBuy('initial_investment', initCash, firstPrice, prices[0]?.timestamp);

    // Build map of dividends by month timestamp (payment date preferred; fallback announce)
    const dividendRows = dividends.map(d => ({
      ts: d.payment_timestamp || d.announce_timestamp,
      amount: d.amount || 0,
    }));

    // Iterate monthly
    for (let i = 1; i < prices.length; i += 1) {
      const p = prices[i];
      const price = p.close_price || 0;

      // Apply monthly cash contribution
      if (monthlyCash > 0) {
        applyBuy('monthly_investment', monthlyCash, price, p.timestamp);
      }

      // Dividends received between previous price ts (exclusive) and current ts (inclusive)
      const prevTs = prices[i - 1].timestamp;
      const currTs = p.timestamp;
      const received = dividendRows.filter(d => d.ts > prevTs && d.ts <= currTs)
        .reduce((acc, d) => acc + d.amount, 0) * shares;

      if (received > 0) {
        totalDividends += received;
        cash += received;
        const before = cash;
        let bought = 0;
        if (reinvest && price > 0) {
          bought = Math.floor(cash / price);
          const cost = bought * price;
          cash -= cost;
          shares += bought;
        }
        ops.push({
          description: reinvest ? 'dividends_received_and_reinvested' : 'dividends_received',
          timestamp: currTs,
          dividend_amount: Number(received.toFixed(2)),
          available_total: Number(cash.toFixed(2)),
          total_investment: Number(investment.toFixed(2)),
          price_used: price,
          shares_bought: bought,
          total_shares: shares,
        });
      }
    }

    // Final valuation at last price
    const lastPrice = prices[prices.length - 1]?.close_price || 0;
    const totalAmount = shares * lastPrice + cash;
    const profit = totalAmount - investment;

    return res.json({
      summary: {
        totalAmount: Number(totalAmount.toFixed(2)),
        totalDividends: Number(totalDividends.toFixed(2)),
        profit: Number(profit.toFixed(2)),
        investment: Number(investment.toFixed(2)),
        shares,
        lastPrice,
        cash: Number(cash.toFixed(2)),
        stock: {
          id: stock.id,
          symbol: stock.symbol,
          longName: stock.longName,
          shortName: stock.shortName,
          firstTradeDate: stock.firstTradeDate,
        },
      },
      detailed_description: ops,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});


