import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'

const GamePage = lazy(() => import('./game/GamePage'))

function Loading() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a0f1f', color: '#ffd6e7', fontFamily: 'Inter, sans-serif' }}>
      Loading our home…
    </div>
  )
}

export default function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/home" element={<Suspense fallback={<Loading />}><GamePage /></Suspense>} />
      </Routes>
    </BrowserRouter>
  )
}
