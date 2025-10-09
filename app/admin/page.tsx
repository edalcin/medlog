'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Stats {
  users: number
  professionals: number
  consultations: number
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/consultations')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) {
        throw new Error('Erro ao carregar estatísticas')
      }
      const data = await response.json()
      setStats(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Usuários</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.users}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Profissionais</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.professionals}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Consultas</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.consultations}</p>
          </div>
        </div>
      )}
    </div>
  )
}
