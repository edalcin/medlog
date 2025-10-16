'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardStats {
  summary: {
    totalConsultations: number
    totalEpisodes: number
    totalProfessionals: number
    totalFiles: number
  }
  bySpecialty: Array<{ name: string; count: number }>
  byClinic: Array<{ name: string; count: number }>
  byYear: Array<{ year: string; count: number }>
  byProfessional: Array<{ name: string; specialty: string; count: number }>
  byMonth: Array<{ month: string; count: number }>
  recentConsultations: Array<{
    id: string
    date: string
    professionalName: string
    specialty: string
  }>
  recentEpisodes: Array<{
    id: string
    date: string
    title: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  const formatMonth = (monthString: string): string => {
    const [year, month] = monthString.split('-')
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${monthNames[parseInt(month) - 1]}/${year}`
  }

  const getMaxValue = (data: Array<{ count: number }>) => {
    return Math.max(...data.map(d => d.count), 1)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando dashboard...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Bem-vindo, {session.user.name}! Aqui está um resumo dos seus registros médicos.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total de Consultas</p>
              <p className="text-4xl font-bold mt-2">{stats.summary.totalConsultations}</p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Total de Episódios</p>
              <p className="text-4xl font-bold mt-2">{stats.summary.totalEpisodes}</p>
            </div>
            <div className="bg-orange-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Profissionais</p>
              <p className="text-4xl font-bold mt-2">{stats.summary.totalProfessionals}</p>
            </div>
            <div className="bg-green-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Arquivos</p>
              <p className="text-4xl font-bold mt-2">{stats.summary.totalFiles}</p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Consultas por Especialidade */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Consultas por Especialidade</h2>
          {stats.bySpecialty.length > 0 ? (
            <div className="space-y-3">
              {stats.bySpecialty.slice(0, 5).map((item, index) => {
                const percentage = (item.count / getMaxValue(stats.bySpecialty)) * 100
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{item.name}</span>
                      <span className="text-gray-500">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
          )}
        </div>

        {/* Consultas por Clínica */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Consultas por Clínica</h2>
          {stats.byClinic.length > 0 ? (
            <div className="space-y-3">
              {stats.byClinic.slice(0, 5).map((item, index) => {
                const percentage = (item.count / getMaxValue(stats.byClinic)) * 100
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{item.name}</span>
                      <span className="text-gray-500">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
          )}
        </div>

        {/* Consultas por Ano */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Consultas por Ano</h2>
          {stats.byYear.length > 0 ? (
            <div className="space-y-3">
              {stats.byYear.map((item, index) => {
                const percentage = (item.count / getMaxValue(stats.byYear)) * 100
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{item.year}</span>
                      <span className="text-gray-500">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
          )}
        </div>

        {/* Evolução Mensal */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolução Mensal (Últimos 12 Meses)</h2>
          {stats.byMonth.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between h-48 gap-1 pb-12">
                {stats.byMonth.slice(-12).map((item, index) => {
                  const percentage = (item.count / getMaxValue(stats.byMonth)) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="relative w-full flex flex-col items-center justify-end h-full">
                        <span className="text-xs font-semibold text-indigo-700 mb-1">
                          {item.count}
                        </span>
                        <div
                          className="w-full bg-indigo-600 rounded-t hover:bg-indigo-700 transition-all duration-300"
                          style={{ height: `${percentage * 1.3}px`, minHeight: '20px' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between gap-1">
                {stats.byMonth.slice(-12).map((item, index) => (
                  <div key={index} className="flex-1 text-center">
                    <span className="text-xs text-gray-500 inline-block transform -rotate-45 origin-center whitespace-nowrap">
                      {formatMonth(item.month)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Profissionais */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profissionais Mais Consultados</h2>
          {stats.byProfessional.length > 0 ? (
            <div className="space-y-3">
              {stats.byProfessional.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.specialty}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
          )}
        </div>

        {/* Consultas Recentes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Consultas Recentes</h2>
            <Link href="/consultations?type=CONSULTATION" className="text-sm text-blue-600 hover:text-blue-700">
              Ver todas →
            </Link>
          </div>
          {stats.recentConsultations.length > 0 ? (
            <div className="space-y-3">
              {stats.recentConsultations.map((item) => (
                <Link
                  key={item.id}
                  href={`/consultations/${item.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.professionalName}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.specialty}</p>
                    </div>
                    <span className="text-xs text-gray-600">{formatDate(item.date)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">Nenhuma consulta registrada ainda</p>
              <Link
                href="/consultations/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nova Consulta
              </Link>
            </div>
          )}
        </div>

        {/* Episódios Recentes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Episódios Recentes</h2>
            <Link href="/consultations?type=EVENT" className="text-sm text-orange-600 hover:text-orange-700">
              Ver todos →
            </Link>
          </div>
          {stats.recentEpisodes.length > 0 ? (
            <div className="space-y-3">
              {stats.recentEpisodes.map((item) => (
                <Link
                  key={item.id}
                  href={`/consultations/${item.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    </div>
                    <span className="text-xs text-gray-600">{formatDate(item.date)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">Nenhum episódio registrado ainda</p>
              <Link
                href="/consultations/new"
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Novo Episódio
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
