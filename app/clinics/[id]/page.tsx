'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Phone {
  id: string
  number: string
  label?: string | null
}

interface Clinic {
  id: string
  name: string
  address?: string | null
  phones?: Phone[]
  _count?: {
    professionals: number
  }
}

export default function ClinicDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [formData, setFormData] = useState<Partial<Clinic>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phones, setPhones] = useState<Phone[]>([])
  const [newPhone, setNewPhone] = useState({ number: '', label: '' })
  const [showAddPhone, setShowAddPhone] = useState(false)

  const fetchClinic = useCallback(async () => {
    try {
      const response = await fetch(`/api/clinics`)
      if (!response.ok) {
        throw new Error('Erro ao carregar clínica')
      }
      const data = await response.json()
      const clinicData = data.data.find((c: Clinic) => c.id === id)

      if (!clinicData) {
        throw new Error('Clínica não encontrada')
      }

      setClinic(clinicData)
      setFormData(clinicData)
      setPhones(clinicData.phones || [])
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
      fetchClinic()
    }
  }, [session, id, fetchClinic])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAddPhone = async () => {
    if (!newPhone.number.trim()) {
      alert('Por favor, insira um número de telefone')
      return
    }

    try {
      const response = await fetch(`/api/clinics/${id}/phones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: newPhone.number.trim(),
          label: newPhone.label.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao adicionar telefone')
      }

      const data = await response.json()
      setPhones([...phones, data.data])
      setNewPhone({ number: '', label: '' })
      setShowAddPhone(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar telefone')
    }
  }

  const handleDeletePhone = async (phoneId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este telefone?')) {
      return
    }

    try {
      const response = await fetch(`/api/clinics/${id}/phones/${phoneId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao remover telefone')
      }

      setPhones(phones.filter(p => p.id !== phoneId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover telefone')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/clinics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar clínica')
      }

      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja remover esta clínica?')) {
      setSubmitting(true)
      setError(null)
      try {
        const response = await fetch(`/api/clinics/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao remover clínica')
        }

        router.push('/admin')
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

  if (error && !clinic) {
    return <div className="flex items-center justify-center min-h-64 text-red-600">{error}</div>
  }

  if (!clinic) {
    return <div className="flex items-center justify-center min-h-64">Clínica não encontrada.</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/admin" className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
          &larr; Voltar para Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Detalhes da Clínica</h1>
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
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Endereço</label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={formData.address || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Telefones</label>
            {phones.length > 0 && (
              <div className="space-y-2 mb-3">
                {phones.map((phone) => (
                  <div key={phone.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{phone.number}</span>
                      {phone.label && (
                        <span className="text-xs text-gray-500 ml-2">({phone.label})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePhone(phone.id)}
                      className="text-red-600 hover:text-red-800 text-sm ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddPhone ? (
              <div className="border border-gray-300 rounded-md p-3 space-y-2">
                <input
                  type="text"
                  value={newPhone.number}
                  onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })}
                  placeholder="Número do telefone"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <input
                  type="text"
                  value={newPhone.label}
                  onChange={(e) => setNewPhone({ ...newPhone, label: e.target.value })}
                  placeholder="Etiqueta (ex: Recepção, WhatsApp) - opcional"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPhone(false)
                      setNewPhone({ number: '', label: '' })
                    }}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddPhone(true)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                + Adicionar telefone
              </button>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
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
