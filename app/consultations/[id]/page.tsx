'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface File {
  id: string
  filename: string
  path: string
  mimeType: string
  size: number
}

interface Professional {
  id: string
  name: string
  specialty: string
  crm: string | null
  phone: string | null
  address: string | null
}

interface Consultation {
  id: string
  date: string
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session && id) {
      fetchConsultation()
    }
  }, [session, id])

  const fetchConsultation = async () => {
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
        <h1 className="text-3xl font-bold text-gray-900">Detalhes da Consulta</h1>
        <p className="mt-2 text-gray-600">
          Consulta de {consultation.professional.specialty} com {consultation.professional.name} em {formatDate(consultation.date)}
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Observações</h2>
        {consultation.notes ? (
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: consultation.notes }} />
        ) : (
          <p className="text-gray-500">Nenhuma observação registrada.</p>
        )}
      </div>

      {consultation.files.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Arquivos</h2>
          <div className="bg-white shadow rounded-lg">
            <ul className="divide-y divide-gray-200">
              {consultation.files.map(file => (
                <li key={file.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <a
                    href={`/api/files/${file.filename}`}
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
