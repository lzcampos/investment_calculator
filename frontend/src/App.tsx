import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Github } from 'lucide-react'
import Home from './pages/Home'
import Simulate from './pages/Simulate'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1">{children}</main>
      <footer className="border-t px-4 sm:px-6 py-6 text-sm flex items-center justify-between text-ink/70">
        <span className="font-semibold">Aportei</span>
        <a href="https://github.com/lzcampos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-ink">
          <Github size={18} />
          <span>github.com/lzcampos</span>
        </a>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/simulate" element={<Simulate />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </BrowserRouter>
  )
}
