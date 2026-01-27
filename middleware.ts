import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next()

    // Security Headers
    // Previne clickjacking - impede que a página seja incorporada em iframes
    response.headers.set('X-Frame-Options', 'DENY')

    // Previne MIME type sniffing - navegador respeita o Content-Type declarado
    response.headers.set('X-Content-Type-Options', 'nosniff')

    // Controla informações enviadas no header Referer
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Restringe acesso a APIs do navegador (câmera, microfone, geolocalização)
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // Força HTTPS por 1 ano (incluindo subdomínios)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )

    // Content Security Policy
    // Nota: unsafe-inline e unsafe-eval são necessários para Next.js/React funcionarem
    // TODO: Migrar para nonces quando Next.js CSP sair do experimental
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    )

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Allow public access to the root page and auth-related pages
        const publicPaths = ['/', '/auth/signin']
        if (publicPaths.includes(pathname) || pathname.startsWith('/api/auth')) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}