'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
)

interface Specialty {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Specialty[]
  crm: string | null
  phone: string | null
}

interface Consultation {
  id: string
  date: string
  notes: string | null
  professionalId: string
}

export default function EditConsultationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    date: '',
    professionalId: '',
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const fetchConsultation = useCallback(async () => {
    try {
      const response = await fetch(`/api/consultations/${id}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar consulta')
      }
      const data = await response.json()
      const consultationData = data.data
      setConsultation(consultationData)

      // Format date for input[type="date"]
      const dateObj = new Date(consultationData.date)
      const formattedDate = dateObj.toISOString().split('T')[0]

      setFormData({
        date: formattedDate,
        professionalId: consultationData.professionalId,
        notes: consultationData.notes || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }, [id])

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals')
      if (!response.ok) {
        throw new Error('Erro ao carregar profissionais')
      }
      const data = await response.json()
      setProfessionals(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session && id) {
      fetchConsultation()
      fetchProfessionals()
    }
  }, [session, id, fetchConsultation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/consultations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar consulta')
      }

      router.push(`/consultations/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleNotesChange = (value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      notes: value || ''
    }))
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href={`/consultations/${id}`} className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
          &larr; Voltar para Detalhes
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Editar Consulta</h1>
        <p className="mt-2 text-gray-600">
          Atualize os dados da consulta médica.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Data da Consulta *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              required
              value={formData.date}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="professionalId" className="block text-sm font-medium text-gray-700">
              Profissional de Saúde *
            </label>
            <select
              id="professionalId"
              name="professionalId"
              required
              value={formData.professionalId}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Selecione um profissional</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name} - {professional.specialties.map(s => s.name).join(', ')}
                  {professional.crm && ` (CRM: ${professional.crm})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <div data-color-mode="light">
              <MDEditor
                value={formData.notes}
                onChange={handleNotesChange}
                preview="edit"
                height={300}
                visibleDragbar={false}
                textareaProps={{
                  placeholder: 'Descreva os sintomas, diagnóstico, tratamento, medicamentos receitados, etc.'
                }}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Você pode usar Markdown para formatar o texto (negrito, itálico, listas, etc.)
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
