'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Specialty {
  id: string
  name: string
}

interface Clinic {
  id: string
  name: string
}

export default function NewProfessionalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [newSpecialtyName, setNewSpecialtyName] = useState('')
  const [showNewSpecialty, setShowNewSpecialty] = useState(false)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<string>('')
  const [newClinicName, setNewClinicName] = useState('')
  const [showNewClinic, setShowNewClinic] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    crm: '',
    address: '',
  })
  const [notes, setNotes] = useState<string | undefined>('')
  const [phones, setPhones] = useState<{ number: string; label: string }[]>([])
  const [newPhone, setNewPhone] = useState({ number: '', label: '' })
  const [showAddPhone, setShowAddPhone] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchSpecialties()
      fetchClinics()
    }
  }, [session])

  const fetchSpecialties = async () => {
    try {
      const response = await fetch('/api/specialties')
      if (!response.ok) throw new Error('Erro ao carregar especialidades')
      const data = await response.json()
      setSpecialties(data.data)
    } catch (err) {
      console.error('Erro ao carregar especialidades:', err)
    }
  }

  const fetchClinics = async () => {
    try {
      const response = await fetch('/api/clinics')
      if (!response.ok) throw new Error('Erro ao carregar clínicas')
      const data = await response.json()
      setClinics(data.data)
    } catch (err) {
      console.error('Erro ao carregar clínicas:', err)
    }
  }

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
      // Add new specialty if provided
      let finalSpecialtyIds = [...selectedSpecialties]
      if (showNewSpecialty && newSpecialtyName.trim()) {
        const specialtyResponse = await fetch('/api/specialties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newSpecialtyName.trim() }),
        })
        if (specialtyResponse.ok) {
          const specialtyData = await specialtyResponse.json()
          finalSpecialtyIds.push(specialtyData.data.id)
        }
      }

      if (finalSpecialtyIds.length === 0) {
        throw new Error('Selecione pelo menos uma especialidade')
      }

      // Add new clinic if provided
      let finalClinicId = selectedClinic
      if (showNewClinic && newClinicName.trim()) {
        const clinicResponse = await fetch('/api/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newClinicName.trim() }),
        })
        if (clinicResponse.ok) {
          const clinicData = await clinicResponse.json()
          finalClinicId = clinicData.data.id
        }
      }

      const response = await fetch('/api/professionals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          notes,
          specialtyIds: finalSpecialtyIds,
          clinicId: finalClinicId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar profissional')
      }

      const professionalData = await response.json()
      const professionalId = professionalData.data.id

      // Create phones if any
      for (const phone of phones) {
        await fetch(`/api/professionals/${professionalId}/phones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(phone),
        })
      }

      router.push('/professionals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSpecialty = (specialtyId: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialtyId)
        ? prev.filter(id => id !== specialtyId)
        : [...prev, specialtyId]
    )
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
        <h1 className="text-3xl font-bold text-gray-900">Novo Profissional</h1>
        <p className="mt-2 text-gray-600">
          Cadastre um novo profissional de saúde.
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
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Especialidades *
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-3">
              {specialties.map((specialty) => (
                <div key={specialty.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`specialty-${specialty.id}`}
                    checked={selectedSpecialties.includes(specialty.id)}
                    onChange={() => toggleSpecialty(specialty.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor={`specialty-${specialty.id}`}
                    className="ml-2 text-sm text-gray-700 cursor-pointer"
                  >
                    {specialty.name}
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowNewSpecialty(!showNewSpecialty)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {showNewSpecialty ? '- Cancelar nova especialidade' : '+ Adicionar nova especialidade'}
              </button>
            </div>
            {showNewSpecialty && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newSpecialtyName}
                  onChange={(e) => setNewSpecialtyName(e.target.value)}
                  placeholder="Nome da nova especialidade"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            )}
            {selectedSpecialties.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSpecialties.map((id) => {
                  const specialty = specialties.find(s => s.id === id)
                  return specialty ? (
                    <span
                      key={id}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {specialty.name}
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clínica ou Hospital
            </label>
            <select
              value={selectedClinic}
              onChange={(e) => setSelectedClinic(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Selecione uma clínica (opcional)</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowNewClinic(!showNewClinic)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {showNewClinic ? '- Cancelar nova clínica' : '+ Adicionar nova clínica'}
              </button>
            </div>
            {showNewClinic && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  placeholder="Nome da nova clínica ou hospital"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="crm" className="block text-sm font-medium text-gray-700">
              CRM
            </label>
            <input
              type="text"
              id="crm"
              name="crm"
              value={formData.crm}
              onChange={handleInputChange}
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
                  placeholder="Etiqueta (ex: Comercial, Celular) - opcional"
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
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <div data-color-mode="light">
              <MDEditor
                value={notes}
                onChange={setNotes}
                preview="edit"
                height={300}
              />
            </div>
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
              {submitting ? 'Salvando...' : 'Salvar Profissional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
