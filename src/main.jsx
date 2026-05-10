import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const APP_BUILD_ID = '2026-05-10-live-sync-1'
const APP_BUILD_STORAGE_KEY = 'roller_erp_build_id'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const refreshForNewBuild = async () => {
      try {
        const previousBuildId = window.localStorage.getItem(APP_BUILD_STORAGE_KEY)
        if (previousBuildId === APP_BUILD_ID) {
          return
        }

        window.localStorage.setItem(APP_BUILD_STORAGE_KEY, APP_BUILD_ID)

        if ('caches' in window) {
          const cacheKeys = await window.caches.keys()
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith('roller-erp-shell-'))
              .map((key) => window.caches.delete(key))
          )
        }
      } catch {}
    }

    refreshForNewBuild().finally(() => {
      navigator.serviceWorker.register(`/sw.js?build=${APP_BUILD_ID}`)
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
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
