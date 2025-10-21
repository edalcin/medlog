/**
 * Get the base URL for the application
 * Uses NEXTAUTH_URL in production, falls back to localhost:3000 in development
 */
export function getBaseUrl(): string {
  // In server-side context (SSR, API routes)
  if (typeof window === 'undefined') {
    // Use NEXTAUTH_URL if available (set in docker/production)
    if (process.env.NEXTAUTH_URL) {
      return process.env.NEXTAUTH_URL
    }

    // Fallback to localhost for development
    return 'http://localhost:3000'
  }

  // In client-side context
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return 'http://localhost:3000'
}

/**
 * Get the full API URL for a given endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getBaseUrl()
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
}
