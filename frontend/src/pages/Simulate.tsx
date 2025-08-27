import { useEffect, useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { motion } from 'framer-motion'
import axios from 'axios'
import { CalendarIcon, ChevronDown, Search } from 'lucide-react'
import clsx from 'clsx'

type StockInfo = {
  id: number
  symbol: string
  longName: string | null
  shortName: string | null
  firstTradeDate: number | null
}

type CalcSummary = {
  totalAmount: number
  monthly_investment?: number
  totalDividends: number
  profit: number
  investment: number
  shares: number
  lastPrice: number
  cash: number
  stock: { id: number, symbol: string, longName: string | null, shortName: string | null, firstTradeDate: number | null }
}

type CalcOp = {
  description: string
  timestamp?: number
  available_total?: number
  total_investment?: number
  price_used?: number
  shares_bought?: number
  total_shares?: number
  dividend_amount?: number
}

type CalcResponse = { summary: CalcSummary, detailed_description: CalcOp[] }

const amountChips = [100, 500, 1000, 5000]

const mapDescription = (op: CalcOp, summary: CalcSummary) => {
  if (op.description === 'initial_investment') {
    return `Aporte inicial de ${op?.total_investment?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  }
  if (op.description === 'monthly_investment') {
    return `Aporte mensal de ${summary.monthly_investment?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  }
  if (op.description === 'dividends_received_and_reinvested') {
    return `Reinvestimento de dividendos: ${op?.dividend_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  }
  return op.description
}

export default function Simulate() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockInfo[]>([])
  const [selected, setSelected] = useState<StockInfo | null>(null)
  const [initial, setInitial] = useState<number | ''>('')
  const [monthlyEnabled, setMonthlyEnabled] = useState(true)
  const [monthly, setMonthly] = useState<number | ''>('')
  const [start, setStart] = useState<Date | undefined>()
  const [reinvest, setReinvest] = useState(true)
  const [openCalendar, setOpenCalendar] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resp, setResp] = useState<CalcResponse | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // search with debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return }
      try {
        const r = await axios.get(`/api/stock_infos/search`, { params: { q: query, limit: 10 } })
        setResults(r.data.items || [])
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const valid = useMemo(() => {
    return Boolean(selected && start && initial !== '' && Number(initial) > 0 && (!monthlyEnabled || monthly === '' || Number(monthly) >= 0))
  }, [selected, start, initial, monthly, monthlyEnabled])

  const submit = async () => {
    if (!valid || !selected || !start) return
    setSubmitting(true); setResp(null); setError(null)
    try {
      const payload = {
        stock_id: selected.id,
        initial_investment: Number(initial),
        investment_start: Math.floor(start.getTime() / 1000),
        monthly_investment: monthlyEnabled ? Number(monthly || 0) : 0,
        reinvest_dividends: reinvest,
      }
      const r = await axios.post(`/api/calculate_investment`, payload)
      setResp(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao calcular')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="text-2xl font-bold mb-4">Simular meus dividendos</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Ticker</label>
            <div className="relative">
              <input
                value={selected ? selected.symbol : query}
                onChange={(e) => { setSelected(null); setQuery(e.target.value) }}
                placeholder="Ex: PETR4"
                className="w-full rounded-md border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
              {(!selected && results.length > 0) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
                  {results.map((r) => (
                    <button key={r.id} onClick={() => { setSelected(r); setQuery('') }} className="w-full text-left px-3 py-2 hover:bg-primary-50">
                      <div className="font-medium">{r.symbol}</div>
                      <div className="text-xs text-ink/60 line-clamp-1">{r.longName || r.shortName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Aporte inicial</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {amountChips.map(v => (
                <button key={v} onClick={() => setInitial(v)} className="px-3 py-1 rounded-full border text-sm hover:bg-primary-50">
                  {v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </button>
              ))}
            </div>
            <input
              value={initial}
              onChange={(e) => setInitial(e.target.value === '' ? '' : Number(e.target.value))}
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Aporte mensal</label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={monthlyEnabled} onChange={(e) => setMonthlyEnabled(e.target.checked)} />
                Habilitar
              </label>
            </div>
            <div className={clsx('flex flex-col gap-2', !monthlyEnabled && 'opacity-50 pointer-events-none') }>
              <div className="flex flex-wrap gap-2">
                {amountChips.map(v => (
                  <button key={v} onClick={() => setMonthly(v)} className="px-3 py-1 rounded-full border text-sm hover:bg-primary-50">
                    {v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </button>
                ))}
              </div>
              <input
                value={monthly}
                onChange={(e) => setMonthly(e.target.value === '' ? '' : Number(e.target.value))}
                type="number"
                min={0}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Início do investimento</label>
            <div className="relative">
              <button type="button" onClick={() => setOpenCalendar(v => !v)} className="w-full rounded-md border px-3 py-2 flex items-center justify-between">
                <span>{start ? start.toLocaleDateString('pt-BR') : 'Selecionar data'}</span>
                <CalendarIcon size={18} />
              </button>
              {openCalendar && (
                <div className="absolute z-10 mt-2 bg-white border rounded-md p-2 shadow">
                  <DayPicker
                    mode="single"
                    selected={start}
                    onSelect={(d) => { setStart(d); setOpenCalendar(false) }}
                    toDate={new Date()}
                    captionLayout="dropdown-buttons"
                    fromYear={1990}
                    toYear={new Date().getFullYear()}
                    showOutsideDays
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="reinvest" type="checkbox" checked={reinvest} onChange={(e) => setReinvest(e.target.checked)} />
            <label htmlFor="reinvest" className="text-sm">Reinvestir dividendos</label>
          </div>

          <div className="pt-2">
            <button
              onClick={submit}
              disabled={!valid || submitting}
              className={clsx('inline-flex items-center justify-center rounded-md px-6 py-3 text-white font-medium shadow transition',
                valid && !submitting ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-300 cursor-not-allowed')}
            >
              {submitting ? 'Calculando...' : 'Calcular'}
            </button>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      </section>

      <section>
        {resp ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-lg mb-2">Resumo</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-ink/60">Ativo</div>
                  <div className="font-medium">{resp.summary.stock.symbol} — {resp.summary.stock.longName || resp.summary.stock.shortName}</div>
                </div>
                <div>
                  <div className="text-ink/60">Início de negociação</div>
                  <div className="font-medium">{resp.summary.stock.firstTradeDate ? new Date(resp.summary.stock.firstTradeDate * 1000).toLocaleDateString('pt-BR') : '-'}</div>
                </div>
                <div>
                  <div className="text-ink/60">Total</div>
                  <div className="font-medium">{resp.summary.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-ink/60">Dividendos</div>
                  <div className="font-medium">{resp.summary.totalDividends.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-ink/60">Aportes</div>
                  <div className="font-medium">{resp.summary.investment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-ink/60">Lucro/Prejuízo</div>
                  <div className="font-medium">{resp.summary.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-ink/60">Cotas</div>
                  <div className="font-medium">{resp.summary.shares}</div>
                </div>
                <div>
                  <div className="text-ink/60">Preço atual</div>
                  <div className="font-medium">{resp.summary.lastPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Histórico de operações</h3>
              {(showAll ? resp.detailed_description : resp.detailed_description.slice(0, 5)).map((op, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="text-sm font-semibold mb-1">{mapDescription(op, resp.summary)}</div>
                  <div className="text-xs text-ink/70 flex flex-wrap gap-3">
                    {op.timestamp && <span>Data: {new Date(op.timestamp * 1000).toLocaleDateString('pt-BR')}</span>}
                    {typeof op.price_used === 'number' && <span>Preço: {op.price_used.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                    {typeof op.shares_bought === 'number' && <span>Compradas: {op.shares_bought}</span>}
                    {typeof op.total_shares === 'number' && <span>Total de cotas: {op.total_shares}</span>}
                    {typeof op.available_total === 'number' && <span>Saldo: {op.available_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                    {typeof op.total_investment === 'number' && <span>Aportes: {op.total_investment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                    {typeof op.total_investment === 'number' && typeof op.total_shares === 'number' && typeof op.price_used === 'number' && <span>Total: {(op.total_shares * op.price_used).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                    {typeof op.dividend_amount === 'number' && <span>Dividendos: {op.dividend_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                  </div>
                </div>
              ))}
              {resp.detailed_description.length > 5 && (
                <button onClick={() => setShowAll(v => !v)} className="text-sm text-primary-700 hover:underline">
                  {showAll ? 'Mostrar menos' : 'Mostrar tudo'}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="text-ink/60">Preencha o formulário e clique em calcular para ver o resultado.</div>
        )}
      </section>
    </div>
  )
}


