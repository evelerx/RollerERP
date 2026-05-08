import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        let hasRefreshed = false

        const promptServiceWorkerUpdate = (worker) => {
          if (!worker) return
          worker.postMessage({ type: 'SKIP_WAITING' })
        }

        if (registration.waiting) {
          promptServiceWorkerUpdate(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptServiceWorkerUpdate(newWorker)
            }
          })
        })

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hasRefreshed) return
          hasRefreshed = true
          window.location.reload()
        })

        return registration.update()
      })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
