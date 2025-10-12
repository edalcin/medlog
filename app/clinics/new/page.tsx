'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewClinicPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
  })
  const [phones, setPhones] = useState<{ number: string; label: string }[]>([])
  const [newPhone, setNewPhone] = useState({ number: '', label: '' })
  const [showAddPhone, setShowAddPhone] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const handleAddPhone = () => {
    if (!newPhone.number.trim()) {
      alert('Por favor, insira um número de telefone')
      return
    }
    setPhones([...phones, { number: newPhone.number.trim(), label: newPhone.label.trim() }])
    setNewPhone({ number: '', label: '' })
    setShowAddPhone(false)
  }

  const handleRemovePhone = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/clinics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar clínica')
      }

      const clinicData = await response.json()
      const clinicId = clinicData.data.id

      // Create phones if any
      for (const phone of phones) {
        await fetch(`/api/clinics/${clinicId}/phones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(phone),
        })
      }

      router.push('/clinics')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (status === 'loading') {
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
        <Link href="/clinics" className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
          &larr; Voltar para Clínicas
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Nova Clínica</h1>
        <p className="mt-2 text-gray-600">
          Cadastre uma nova clínica ou hospital.
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ex: Hospital Particular, UBS Central, Clínica São José"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Endereço
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Endereço completo da clínica ou hospital"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Telefones</label>
            {phones.length > 0 && (
              <div className="space-y-2 mb-3">
                {phones.map((phone, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{phone.number}</span>
                      {phone.label && (
                        <span className="text-xs text-gray-500 ml-2">({phone.label})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(index)}
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
                  placeholder="Etiqueta (ex: Recepção, WhatsApp, Agendamento) - opcional"
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
              {submitting ? 'Salvando...' : 'Salvar Clínica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
