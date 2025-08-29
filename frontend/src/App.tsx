import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Github } from 'lucide-react'
import Home from './pages/Home'
import Simulate from './pages/Simulate'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <footer className="border-t px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center justify-center text-ink/70">
        <a href="https://github.com/lzcampos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 sm:gap-3 hover:text-ink">
          <Github size={18} />
          <span className="font-medium">github.com/lzcampos</span>
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
            <Route path="/simular" element={<Simulate />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </BrowserRouter>
  )
}
