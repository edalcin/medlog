'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Consultation {
  id: string
  date: string
  notes: string | null
  professional: {
    id: string
    name: string
    specialty: string
  }
  files: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    uploadedAt: string
  }>
}

export default function ConsultationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchConsultations()
    }
  }, [session])

  const fetchConsultations = async () => {
    try {
      const response = await fetch('/api/consultations')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Minhas Consultas</h1>
        <Link
          href="/consultations/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Nova Consulta
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {consultations.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma consulta</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece registrando sua primeira consulta médica.
          </p>
          <div className="mt-6">
            <Link
              href="/consultations/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nova Consulta
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {consultations.map((consultation) => (
              <li key={consultation.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {consultation.professional.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {consultation.professional.specialty} • {formatDate(consultation.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {consultation.files.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {consultation.files.length} arquivo{consultation.files.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <Link
                        href={`/consultations/${consultation.id}`}
                        className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </div>
                  {consultation.notes && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {consultation.notes}
                      </p>
                    </div>
                  )}
                  {consultation.files.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-2">
                        {consultation.files.slice(0, 3).map((file) => (
                          <span
                            key={file.id}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {file.filename} ({formatFileSize(file.size)})
                          </span>
                        ))}
                        {consultation.files.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                            +{consultation.files.length - 3} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}