'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Specialty {
  id: string
  name: string
}

interface Clinic {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Specialty[]
  crm: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  clinicId: string | null
  clinic: Clinic | null
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
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [newSpecialtyName, setNewSpecialtyName] = useState('')
  const [showNewSpecialty, setShowNewSpecialty] = useState(false)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<string>('')
  const [newClinicName, setNewClinicName] = useState('')
  const [showNewClinic, setShowNewClinic] = useState(false)
  const [notes, setNotes] = useState<string | undefined>('')
  const [isEditing, setIsEditing] = useState(false)

  const fetchProfessional = useCallback(async () => {
    try {
      const response = await fetch(`/api/professionals/${id}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar profissional')
      }
      const data = await response.json()
      setProfessional(data.data)
      setFormData(data.data)
      setSelectedSpecialties(data.data.specialties?.map((s: Specialty) => s.id) || [])
      setSelectedClinic(data.data.clinicId || '')
      setNotes(data.data.notes || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchSpecialties = useCallback(async () => {
    try {
      const response = await fetch('/api/specialties')
      if (!response.ok) throw new Error('Erro ao carregar especialidades')
      const data = await response.json()
      setSpecialties(data.data)
    } catch (err) {
      console.error('Erro ao carregar especialidades:', err)
    }
  }, [])

  const fetchClinics = useCallback(async () => {
    try {
      const response = await fetch('/api/clinics')
      if (!response.ok) throw new Error('Erro ao carregar clínicas')
      const data = await response.json()
      setClinics(data.data)
    } catch (err) {
      console.error('Erro ao carregar clínicas:', err)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session && id) {
      fetchProfessional()
      fetchSpecialties()
      fetchClinics()
    }
  }, [session, id, fetchProfessional, fetchSpecialties, fetchClinics])

  const toggleSpecialty = (specialtyId: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialtyId)
        ? prev.filter(id => id !== specialtyId)
        : [...prev, specialtyId]
    )
  }

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

      const response = await fetch(`/api/professionals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          notes,
          specialtyIds: finalSpecialtyIds,
          clinicId: finalClinicId || null,
        }),
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

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Observações
              </label>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {isEditing ? 'Visualizar' : 'Editar'}
              </button>
            </div>
            {isEditing ? (
              <div data-color-mode="light">
                <MDEditor
                  value={notes}
                  onChange={setNotes}
                  preview="edit"
                  height={300}
                />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none border border-gray-300 rounded-md p-4 min-h-[100px] bg-gray-50">
                {notes ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notes}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Nenhuma observação registrada</p>
                )}
              </div>
            )}
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