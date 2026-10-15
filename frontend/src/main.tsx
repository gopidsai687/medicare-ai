import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/lib/toast'
import { router } from '@/router'
import '@/index.css'

// ── Auto-Recovery for Stale Vite Chunks on New Deployments ────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    const reloadKey = 'medicare_preload_recovery'
    const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0)
    if (Date.now() - lastReload > 10000) {
      window.sessionStorage.setItem(reloadKey, String(Date.now()))
      window.location.reload()
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event?.reason?.message || ''
    if (
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('error loading dynamically imported module') ||
      errorMsg.includes('Importing a module script failed') ||
      event?.reason?.name === 'ChunkLoadError'
    ) {
      event.preventDefault()
      const reloadKey = 'medicare_chunk_recovery'
      const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0)
      if (Date.now() - lastReload > 10000) {
        window.sessionStorage.setItem(reloadKey, String(Date.now()))
        window.location.reload()
      }
    }
  })
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
