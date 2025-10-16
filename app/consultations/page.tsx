'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Specialty {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Specialty[]
}

interface Consultation {
  id: string
  date: string
  proposito: string | null
  notes: string | null
  type: 'CONSULTATION' | 'EVENT'
  professional: Professional | null
  user?: {
    id: string
    name: string
    username?: string
    email: string
  }
  files: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    uploadedAt: string
  }>
}

function ConsultationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [yearFilter, setYearFilter] = useState<string>('')
  const [professionalFilter, setProfessionalFilter] = useState<string>('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Sorting
  const [sortColumn, setSortColumn] = useState<'date' | 'professional' | 'specialties'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Apply type filter from query params
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam === 'CONSULTATION' || typeParam === 'EVENT') {
      setTypeFilter(typeParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (session) {
      fetchConsultations()
      fetchProfessionals()
      fetchSpecialties()
    }
  }, [session])

  const fetchConsultations = async () => {
    try {
      // Fetch with large limit to get all consultations
      const response = await fetch('/api/consultations?limit=1000')
      if (!response.ok) {
        throw new Error('Erro ao carregar consultas')
      }
      const data = await response.json()
      setConsultations(data.data.consultations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals?status=all')
      if (!response.ok) return
      const data = await response.json()
      setProfessionals(data.data)
    } catch (err) {
      console.error('Erro ao carregar profissionais:', err)
    }
  }

  const fetchSpecialties = async () => {
    try {
      const response = await fetch('/api/specialties')
      if (!response.ok) return
      const data = await response.json()
      setSpecialties(data.data)
    } catch (err) {
      console.error('Erro ao carregar especialidades:', err)
    }
  }

  const handleSortChange = (column: 'date' | 'professional' | 'specialties') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getFilteredAndSortedConsultations = () => {
    let filtered = [...consultations]

    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(c => c.type === typeFilter)
    }

    // Apply year filter
    if (yearFilter) {
      filtered = filtered.filter(c => {
        const year = new Date(c.date).getUTCFullYear().toString()
        return year === yearFilter
      })
    }

    // Apply date range filter
    if (startDate) {
      filtered = filtered.filter(c => {
        const consultDate = new Date(c.date).toISOString().split('T')[0]
        return consultDate >= startDate
      })
    }
    if (endDate) {
      filtered = filtered.filter(c => {
        const consultDate = new Date(c.date).toISOString().split('T')[0]
        return consultDate <= endDate
      })
    }

    // Apply professional filter (only for consultations)
    if (professionalFilter) {
      filtered = filtered.filter(c => c.professional?.id === professionalFilter)
    }

    // Apply specialty filter (only for consultations)
    if (specialtyFilter) {
      filtered = filtered.filter(c =>
        c.professional?.specialties.some(s => s.id === specialtyFilter)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'professional':
          const aName = a.professional?.name || ''
          const bName = b.professional?.name || ''
          comparison = aName.localeCompare(bName)
          break
        case 'specialties':
          const aSpec = a.professional?.specialties.map(s => s.name).join(', ') || ''
          const bSpec = b.professional?.specialties.map(s => s.name).join(', ') || ''
          comparison = aSpec.localeCompare(bSpec)
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }

  // Get unique years from consultations
  const getAvailableYears = () => {
    const years = consultations.map(c => new Date(c.date).getUTCFullYear())
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }

  const formatDate = (dateString: string) => {
    // Parse the date string manually to avoid timezone issues
    const date = new Date(dateString)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${day}/${month}/${year}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">Carregando consultas...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const filteredConsultations = getFilteredAndSortedConsultations()
  const availableYears = getAvailableYears()

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Consultas e Eventos</h1>
        <Link
          href="/consultations/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Nova Consulta ou Evento
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              <option value="CONSULTATION">Consultas</option>
              <option value="EVENT">Eventos</option>
            </select>
          </div>

          <div>
            <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>
            <select
              id="year-filter"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="professional-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Profissional
            </label>
            <select
              id="professional-filter"
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              {professionals.map(prof => (
                <option key={prof.id} value={prof.id}>{prof.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="specialty-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Especialidade
            </label>
            <select
              id="specialty-filter"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Todas</option>
              {specialties.map(spec => (
                <option key={spec.id} value={spec.id}>{spec.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filters button */}
        {(typeFilter || yearFilter || startDate || endDate || professionalFilter || specialtyFilter) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setTypeFilter('')
                setYearFilter('')
                setStartDate('')
                setEndDate('')
                setProfessionalFilter('')
                setSpecialtyFilter('')
              }}
              className="text-sm text-blue-600 hover:text-blue-900"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Mostrando {filteredConsultations.length} de {consultations.length} registro{consultations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {consultations.length === 0 ? (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum registro</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece registrando sua primeira consulta ou evento de saúde.
          </p>
          <div className="mt-6">
            <Link
              href="/consultations/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nova Consulta ou Evento
            </Link>
          </div>
        </div>
      ) : filteredConsultations.length === 0 ? (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <p className="text-gray-500">Nenhum registro corresponde aos filtros selecionados.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortChange('date')}
                >
                  <div className="flex items-center">
                    Data
                    {sortColumn === 'date' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {session?.user?.role === 'ADMIN' && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortChange('professional')}
                >
                  <div className="flex items-center">
                    Profissional
                    {sortColumn === 'professional' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortChange('specialties')}
                >
                  <div className="flex items-center">
                    Especialidades
                    {sortColumn === 'specialties' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Propósito / Evento
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredConsultations.map((consultation) => (
                <tr key={consultation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      consultation.type === 'CONSULTATION'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {consultation.type === 'CONSULTATION' ? 'Consulta' : 'Evento'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(consultation.date)}
                  </td>
                  {session?.user?.role === 'ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {consultation.user?.username || consultation.user?.email || '-'}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {consultation.professional?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {consultation.professional?.specialties.map((specialty) => (
                        <span
                          key={specialty.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {specialty.name}
                        </span>
                      )) || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {consultation.proposito || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {consultation.files.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                        {consultation.files.length} arquivo{consultation.files.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <Link
                      href={`/consultations/${consultation.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ConsultationsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Carregando consultas...</div>
        </div>
      }
    >
      <ConsultationsPage />
    </Suspense>
  )
}