'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Professional {
  id: string
  name: string
  specialty: string
  crm: string | null
  phone: string | null
  address: string | null
  isActive: boolean
}

export default function ProfessionalDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [professional, setProfessional] = useState<Professional | null>(null)
  const [formData, setFormData] = useState<Partial<Professional>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfessional = useCallback(async () => {
    try {
      const response = await fetch(`/api/professionals/${id}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar profissional')
      }
      const data = await response.json()
      setProfessional(data.data)
      setFormData(data.data)
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
      fetchProfessional()
    }
  }, [session, id, fetchProfessional])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/professionals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar profissional')
      }

      router.push('/professionals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja remover este profissional?')) {
      setSubmitting(true)
      setError(null)
      try {
        const response = await fetch(`/api/professionals/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao remover profissional')
        }

        router.push('/professionals')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-64">Carregando...</div>
  }

  if (!session) {
    return null
  }
  
  if (error) {
    return <div className="flex items-center justify-center min-h-64 text-red-600">{error}</div>
  }

  if (!professional) {
    return <div className="flex items-center justify-center min-h-64">Profissional não encontrado.</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/professionals" className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
          &larr; Voltar para Profissionais
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Detalhes do Profissional</h1>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome *</label>
            <input type="text" id="name" name="name" required value={formData.name || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>

          <div>
            <label htmlFor="specialty" className="block text-sm font-medium text-gray-700">Especialidade *</label>
            <input type="text" id="specialty" name="specialty" required value={formData.specialty || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>

          <div>
            <label htmlFor="crm" className="block text-sm font-medium text-gray-700">CRM</label>
            <input type="text" id="crm" name="crm" value={formData.crm || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefone</label>
            <input type="text" id="phone" name="phone" value={formData.phone || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Endereço</label>
            <textarea id="address" name="address" rows={3} value={formData.address || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          
          <div className="flex items-center">
            <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive || false} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Ativo</label>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Removendo...' : 'Remover'}
            </button>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}