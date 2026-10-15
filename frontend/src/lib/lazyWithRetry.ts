import { ComponentType, lazy, LazyExoticComponent } from 'react'

/**
 * Resilient lazy loader for code-split components.
 * Automatically recovers from stale Vite chunks after new deployments
 * by triggering a controlled, single-time page reload before surfacing errors.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const retryKey = `medicare_chunk_retry_${chunkName}`
    try {
      const module = await factory()
      // Successful load — clear any previous reload flag for this chunk
      window.sessionStorage.removeItem(retryKey)
      return module
    } catch (error: any) {
      console.warn(`[MediCare AI] Failed to fetch chunk "${chunkName}":`, error)

      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('error loading dynamically imported module') ||
        error?.message?.includes('dynamically imported module') ||
        error?.name === 'ChunkLoadError'

      const hasRetried = window.sessionStorage.getItem(retryKey)

      // If this is a chunk fetch failure and we haven't retried yet in this session:
      // Perform a clean reload from server to fetch the updated index.html with new asset hashes.
      if (isChunkError && !hasRetried) {
        window.sessionStorage.setItem(retryKey, 'true')
        window.location.reload()
        return new Promise(() => {}) // Keep promise pending while browser navigates
      }

      // If already retried or a different error, rethrow so the RouteErrorBoundary displays a recovery card
      throw error
    }
  })
}
