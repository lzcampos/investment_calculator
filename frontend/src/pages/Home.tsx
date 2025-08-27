import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const heroPhrases = [
  'Veja como seus dividendos crescem mês a mês.',
  'Simule aportes, reinvista dividendos e acompanhe seus resultados.',
  'Transforme dados da B3 em insights para sua renda passiva.',
]

const subcopyPhrases = [
  'De forma simples, visualize o histórico de ações e dividendos, entenda o impacto dos seus aportes mensais e veja onde sua estratégia pode te levar.',
  'Todos os proventos e preços históricos em um só lugar. Da B3 direto para sua tela.',
]

const ctaPhrases = [
  'Comece agora',
  'Simular meus dividendos',
  'Explorar dados da bolsa',
]

export default function Home() {
  const navigate = useNavigate()
  const [heroIdx, setHeroIdx] = useState(0)
  const [subIdx, setSubIdx] = useState(0)
  const [ctaIdx, setCtaIdx] = useState(0)

  useEffect(() => {
    const i1 = setInterval(() => setHeroIdx((i) => (i + 1) % heroPhrases.length), 3500)
    const i2 = setInterval(() => setSubIdx((i) => (i + 1) % subcopyPhrases.length), 5000)
    const i3 = setInterval(() => setCtaIdx((i) => (i + 1) % ctaPhrases.length), 2500)
    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3) }
  }, [])

  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">
            Aportei
          </h1>
          <div className="mt-6 h-20 sm:h-16">
            <AnimatePresence mode="wait">
              <motion.p
                key={heroIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                className="text-xl sm:text-2xl text-ink/80"
              >
                {heroPhrases[heroIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-6 min-h-16">
            <AnimatePresence mode="wait">
              <motion.p
                key={subIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                className="text-base sm:text-lg text-ink/70 max-w-3xl mx-auto"
              >
                {subcopyPhrases[subIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-10">
            <button
              onClick={() => navigate('/simulate')}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-base font-medium shadow transition"
            >
              {ctaPhrases[ctaIdx]}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


