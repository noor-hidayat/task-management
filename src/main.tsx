import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: bikin app shell tetap kebuka saat offline / sinyal jelek.
// Hanya di build produksi — saat `vite dev` SW justru bikin hot-reload bingung.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support opsional; abaikan kalau browser menolak */
    })
  })
}
