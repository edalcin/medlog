'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface File {
  id: string
  filename: string
  customName?: string | null
  path: string
  mimeType: string
  size: number
}

interface Specialty {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Specialty[]
  crm: string | null
  address: string | null
}

interface Consultation {
  id: string
  date: string
  proposito: string | null
  notes: string | null
  professional: Professional
  files: File[]
}

export default function ConsultationDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchConsultation = useCallback(async () => {
    try {
      const response = await fetch(`/api/consultations/${id}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar consulta')
      }
      const data = await response.json()
      setConsultation(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session && id) {
      fetchConsultation()
    }
  }, [session, id, fetchConsultation])
  
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

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta consulta? Esta ação não pode ser desfeita.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/consultations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir consulta')
      }

      router.push('/consultations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setDeleting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }
  
  if (error) {
    return (
        <div className="flex items-center justify-center min-h-64">
            <div className="text-lg text-red-600">{error}</div>
      </div>
    )
  }

  if (!consultation) {
    return (
        <div className="flex items-center justify-center min-h-64">
            <div className="text-lg">Consulta não encontrada.</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/consultations" className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
          &larr; Voltar para Consultas
        </Link>
        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-gray-900">Detalhes da Consulta</h1>
          <div className="flex gap-2">
            <Link
              href={`/consultations/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Editar
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>

      {/* Informações da consulta */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="space-y-4">
          <div>
            <span className="text-gray-600">Data da Consulta: </span>
            <span className="font-medium text-gray-900">{formatDate(consultation.date)}</span>
          </div>

          <div>
            <span className="text-gray-600">Profissional: </span>
            <span className="font-medium text-gray-900">{consultation.professional.name}</span>
            {consultation.professional.crm && (
              <span className="text-gray-600"> • CRM: {consultation.professional.crm}</span>
            )}
          </div>

          <div>
            <span className="text-gray-600">Especialidades: </span>
            {consultation.professional.specialties?.map((specialty, index) => (
              <span key={specialty.id}>
                <span className="font-medium text-gray-900">{specialty.name}</span>
                {index < consultation.professional.specialties.length - 1 && ', '}
              </span>
            ))}
          </div>

          {consultation.proposito && (
            <div>
              <span className="text-gray-600">Propósito da Consulta: </span>
              <span className="font-medium text-gray-900">{consultation.proposito}</span>
            </div>
          )}

          <div>
            <div className="text-gray-600 mb-2">Observações:</div>
            {consultation.notes ? (
              <div className="prose max-w-none pl-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {consultation.notes}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="text-gray-500 italic pl-4">Nenhuma observação registrada.</span>
            )}
          </div>
        </div>
      </div>

      {consultation.files.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Arquivos</h2>
          <div className="bg-white shadow rounded-lg">
            <ul className="divide-y divide-gray-200">
              {consultation.files.map(file => (
                <li key={file.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.customName || file.filename}</p>
                    {file.customName && <p className="text-xs text-gray-400">{file.filename}</p>}
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <a
                    href={`/api/files/${file.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    Visualizar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}