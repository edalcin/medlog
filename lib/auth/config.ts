import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '../prisma/client'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  // NextAuth automatically uses NEXTAUTH_URL from environment
  // In production with Docker: uses the URL from environment variable
  // In development: defaults to http://localhost:3000 (from .env.local)
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        // Register login
        try {
          await prisma.loginLog.create({
            data: {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              timestamp: new Date()
            }
          })
        } catch (error) {
          console.error('Failed to record login:', error)
          // Don't fail login if logging fails
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.name = token.name as string
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Permite redirecionamentos para URLs relativas
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Só permite redirecionamentos para o mesmo domínio
      else if (new URL(url).origin === baseUrl) return url
      // Fallback para home
      return baseUrl
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
}