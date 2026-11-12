import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
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
        <Route path="/" element={<Suspense fallback={<Loading />}><GamePage /></Suspense>} />
        <Route path="/home" element={<Navigate to={{ pathname: '/', search: location.search }} replace />} />
        <Route path="/letter" element={<App />} />
      </Routes>
    </BrowserRouter>
  )
}
