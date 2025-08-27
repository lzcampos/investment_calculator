import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');
const CSV_PATH = path.join(ROOT_DIR, 'data', 'acoes-listadas-b3.csv');
const DB_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DB_DIR, 'stocks.sqlite3');
const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// CLI args
const argv = process.argv.slice(2);
const limitArgIdx = argv.findIndex((a) => a === '--limit');
const LIMIT = limitArgIdx !== -1 ? Number(argv[limitArgIdx + 1]) : undefined;

function ensureDirectories() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

function openDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_infos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT,
      symbol TEXT UNIQUE,
      exchangeName TEXT,
      fullExchangeName TEXT,
      instrumentType TEXT,
      firstTradeDate INTEGER,
      timezone TEXT,
      exchangeTimezoneName TEXT,
      regularMarketPrice INTEGER,
      longName TEXT,
      shortName TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_historical_price (
      stock_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      low_price REAL,
      open_price REAL,
      close_price REAL,
      PRIMARY KEY (stock_id, timestamp),
      FOREIGN KEY (stock_id) REFERENCES stock_infos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_historical_dividend_yield (
      stock_id INTEGER NOT NULL,
      announce_timestamp INTEGER NOT NULL,
      payment_timestamp INTEGER,
      amount REAL,
      PRIMARY KEY (stock_id, announce_timestamp),
      FOREIGN KEY (stock_id) REFERENCES stock_infos(id) ON DELETE CASCADE
    );
  `);
}

function readTickers(csvPath) {
  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
  });
  const tickers = [];
  const seen = new Set();
  for (const row of records) {
    const rawTicker = (row.Ticker || row.ticker || '').toString().trim();
    if (!rawTicker) continue;
    if (seen.has(rawTicker)) continue;
    seen.add(rawTicker);
    tickers.push(rawTicker);
  }
  return tickers;
}

async function fetchYahooChart(ticker) {
  const symbol = `${ticker}.SA`;
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=max&interval=1mo&events=div%2Csplit`;
  const response = await axios.get(url, { timeout: 30000 });
  return response.data;
}

function extractMeta(result) {
  const meta = result?.meta || {};
  return {
    currency: meta.currency ?? null,
    symbol: meta.symbol ?? null,
    exchangeName: meta.exchangeName ?? null,
    fullExchangeName: meta.fullExchangeName ?? null,
    instrumentType: meta.instrumentType ?? null,
    firstTradeDate: Number(meta.firstTradeDate) || null,
    timezone: meta.timezone ?? null,
    exchangeTimezoneName: meta.exchangeTimezoneName ?? null,
    regularMarketPrice: Number(meta.regularMarketPrice) || null,
    longName: meta.longName ?? null,
    shortName: meta.shortName ?? null,
  };
}

function extractPrices(result) {
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const lows = quote.low || [];
  const opens = quote.open || [];
  const closes = quote.close || [];
  const rows = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = Number(timestamps[i]);
    if (!ts) continue;
    rows.push({
      timestamp: ts,
      low_price: typeof lows[i] === 'number' ? lows[i] : null,
      open_price: typeof opens[i] === 'number' ? opens[i] : null,
      close_price: typeof closes[i] === 'number' ? closes[i] : null,
    });
  }
  return rows;
}

function extractDividends(result) {
  const divs = result?.events?.dividends || {};
  const rows = [];
  for (const [announceTsStr, payload] of Object.entries(divs)) {
    const announceTs = Number(announceTsStr);
    if (!announceTs) continue;
    const amount = typeof payload?.amount === 'number' ? payload.amount : null;
    const paymentTs = Number(payload?.date) || null;
    rows.push({ announce_timestamp: announceTs, payment_timestamp: paymentTs, amount });
  }
  return rows;
}

function upsertStockInfo(db, meta) {
  const insert = db.prepare(`
    INSERT INTO stock_infos (
      currency, symbol, exchangeName, fullExchangeName, instrumentType, firstTradeDate,
      timezone, exchangeTimezoneName, regularMarketPrice, longName, shortName
    ) VALUES (@currency, @symbol, @exchangeName, @fullExchangeName, @instrumentType, @firstTradeDate,
      @timezone, @exchangeTimezoneName, @regularMarketPrice, @longName, @shortName)
    ON CONFLICT(symbol) DO UPDATE SET
      currency=excluded.currency,
      exchangeName=excluded.exchangeName,
      fullExchangeName=excluded.fullExchangeName,
      instrumentType=excluded.instrumentType,
      firstTradeDate=excluded.firstTradeDate,
      timezone=excluded.timezone,
      exchangeTimezoneName=excluded.exchangeTimezoneName,
      regularMarketPrice=excluded.regularMarketPrice,
      longName=excluded.longName,
      shortName=excluded.shortName
  `);
  insert.run(meta);
  const idRow = db.prepare('SELECT * FROM stock_infos WHERE symbol = ?').get(meta.symbol);
  console.log("stock_infos", idRow);
  return idRow?.id;
}

function replaceHistorical(db, stockId, prices, dividends) {
  const delPrices = db.prepare('DELETE FROM stock_historical_price WHERE stock_id = ?');
  const delDivs = db.prepare('DELETE FROM stock_historical_dividend_yield WHERE stock_id = ?');
  const insertPrice = db.prepare(`
    INSERT OR REPLACE INTO stock_historical_price (stock_id, timestamp, low_price, open_price, close_price)
    VALUES (@stock_id, @timestamp, @low_price, @open_price, @close_price)
  `);
  const insertDiv = db.prepare(`
    INSERT OR REPLACE INTO stock_historical_dividend_yield (stock_id, announce_timestamp, payment_timestamp, amount)
    VALUES (@stock_id, @announce_timestamp, @payment_timestamp, @amount)
  `);

  const tx = db.transaction(() => {
    delPrices.run(stockId);
    delDivs.run(stockId);
    for (const r of prices) insertPrice.run({ stock_id: stockId, ...r });
    for (const d of dividends) insertDiv.run({ stock_id: stockId, ...d });
  });
  tx();
  return { pricesInserted: prices.length, dividendsInserted: dividends.length };
}

async function ingestTicker(db, ticker) {
  try {
    const data = await fetchYahooChart(ticker);
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('Empty result');
    const meta = extractMeta(result);
    if (!meta.symbol) throw new Error('Missing symbol in meta');
    const stockId = upsertStockInfo(db, meta);
    const prices = extractPrices(result);
    const dividends = extractDividends(result);
    const { pricesInserted, dividendsInserted } = replaceHistorical(db, stockId, prices, dividends);
    return { ticker, stockId, pricesInserted, dividendsInserted };
  } catch (err) {
    return { ticker, error: err?.message || String(err) };
  }
}

async function main() {
  ensureDirectories();
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const db = openDatabase();
  createSchema(db);

  const tickers = readTickers(CSV_PATH);
  const selected = typeof LIMIT === 'number' && LIMIT > 0 ? tickers.slice(0, LIMIT) : tickers;
  console.log(`Tickers to ingest: ${selected.length} (of ${tickers.length})`);

  const results = [];
  for (let i = 0; i < selected.length; i += 1) {
    const t = selected[i];
    process.stdout.write(`\r[${i + 1}/${selected.length}] ${t}        `);
    // Sequential to be gentle with the API. Adjust if needed.
    // eslint-disable-next-line no-await-in-loop
    const res = await ingestTicker(db, t);
    results.push(res);
    // Small delay
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 150));
  }
  process.stdout.write('\n');

  const successes = results.filter((r) => !r.error);
  const failures = results.filter((r) => r.error);
  const priceCount = successes.reduce((acc, r) => acc + (r.pricesInserted || 0), 0);
  const divCount = successes.reduce((acc, r) => acc + (r.dividendsInserted || 0), 0);
  console.log(`Ingest complete. Stocks: ${successes.length} ok, ${failures.length} failed.`);
  console.log(`Inserted price rows: ${priceCount}, dividend rows: ${divCount}`);

  if (failures.length) {
    console.log('Some failures:');
    for (const f of failures.slice(0, 10)) {
      console.log(` - ${f.ticker}: ${f.error}`);
    }
    if (failures.length > 10) console.log(` ... and ${failures.length - 10} more.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


