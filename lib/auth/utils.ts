import { getServerSession } from 'next-auth'
import { authOptions } from './config'
import { redirect } from 'next/navigation'

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }
  return session
}

export async function ensureAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') {
    throw new Error('Acesso negado')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }
  return session
}

export function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN'
}