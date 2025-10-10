'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Specialty {
  id: string
  name: string
}

interface FileRecord {
  id: string
  filename: string
  path: string
  mimeType: string
  size: number
  uploadedAt: string
  consultation: {
    id: string
    date: string
    user: {
      id: string
      name: string
      email: string
    }
  }
  professional: {
    id: string
    name: string
    specialties: Specialty[]
  }
  category?: {
    id: string
    name: string
  }
}

interface Consultation {
  id: string
  date: string
  notes: string | null
  user: {
    id: string
    name: string
    email: string
  }
  professional: {
    id: string
    name: string
    specialties: Specialty[]
  }
  files: Array<{
    id: string
    filename: string
  }>
}

interface Professional {
  id: string
  name: string
  crm: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  specialties: Specialty[]
  _count: {
    consultations: number
  }
}

interface FileCategory {
  id: string
  name: string
  createdAt: string
  _count?: {
    files: number
  }
}

interface SpecialtyWithCount {
  id: string
  name: string
  createdAt: string
  _count?: {
    professionals: number
  }
}

interface ClinicWithCount {
  id: string
  name: string
  createdAt: string
  _count?: {
    professionals: number
  }
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyWithCount[]>([])
  const [fileCategories, setFileCategories] = useState<FileCategory[]>([])
  const [clinics, setClinics] = useState<ClinicWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(true)
  const [consultationsLoading, setConsultationsLoading] = useState(true)
  const [professionalsLoading, setProfessionalsLoading] = useState(true)
  const [specialtiesLoading, setSpecialtiesLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [clinicsLoading, setClinicsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'files' | 'consultations' | 'professionals' | 'specialties' | 'categories' | 'clinics'>('users')
  const [selectedConsultations, setSelectedConsultations] = useState<Set<string>>(new Set())
  const [selectedProfessionals, setSelectedProfessionals] = useState<Set<string>>(new Set())
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyWithCount | null>(null)
  const [editingCategory, setEditingCategory] = useState<FileCategory | null>(null)
  const [editingClinic, setEditingClinic] = useState<ClinicWithCount | null>(null)
  const [isSpecialtyFormOpen, setIsSpecialtyFormOpen] = useState(false)
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
  const [isClinicFormOpen, setIsClinicFormOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/consultations')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchUsers()
      fetchFiles()
      fetchConsultations()
      fetchProfessionals()
      fetchSpecialties()
      fetchFileCategories()
      fetchClinics()
    }
  }, [session])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }
      const data = await response.json()
      setUsers(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const fetchFiles = async () => {
    try {
      setFilesLoading(true)
      const response = await fetch('/api/files')
      if (!response.ok) {
        throw new Error('Erro ao carregar arquivos')
      }
      const data = await response.json()
      setFiles(data.data.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setFilesLoading(false)
    }
  }

  const fetchConsultations = async () => {
    try {
      setConsultationsLoading(true)
      const response = await fetch('/api/admin/consultations')
      if (!response.ok) {
        throw new Error('Erro ao carregar consultas')
      }
      const data = await response.json()
      setConsultations(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setConsultationsLoading(false)
    }
  }

  const fetchProfessionals = async () => {
    try {
      setProfessionalsLoading(true)
      const response = await fetch('/api/admin/professionals')
      if (!response.ok) {
        throw new Error('Erro ao carregar profissionais')
      }
      const data = await response.json()
      setProfessionals(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setProfessionalsLoading(false)
    }
  }

  const fetchSpecialties = async () => {
    try {
      setSpecialtiesLoading(true)
      const response = await fetch('/api/specialties')
      if (!response.ok) {
        throw new Error('Erro ao carregar especialidades')
      }
      const data = await response.json()
      setSpecialties(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSpecialtiesLoading(false)
    }
  }

  const fetchFileCategories = async () => {
    try {
      setCategoriesLoading(true)
      const response = await fetch('/api/file-categories')
      if (!response.ok) {
        throw new Error('Erro ao carregar categorias')
      }
      const data = await response.json()
      setFileCategories(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const fetchClinics = async () => {
    try {
      setClinicsLoading(true)
      const response = await fetch('/api/clinics')
      if (!response.ok) {
        throw new Error('Erro ao carregar clínicas')
      }
      const data = await response.json()
      setClinics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setClinicsLoading(false)
    }
  }

  const handleCreateUser = () => {
    setEditingUser(null)
    setIsFormOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setIsFormOpen(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          throw new Error('Erro ao excluir usuário')
        }
        fetchUsers()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const userData = Object.fromEntries(formData.entries())

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        throw new Error(editingUser ? 'Erro ao atualizar usuário' : 'Erro ao criar usuário')
      }

      setIsFormOpen(false)
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  const handleDeleteFile = async (filename: string) => {
    if (window.confirm('Tem certeza que deseja excluir este arquivo? Esta ação não pode ser desfeita.')) {
      try {
        const response = await fetch(`/api/files/${filename}/delete`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          throw new Error('Erro ao excluir arquivo')
        }
        fetchFiles()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // Consultation handlers
  const toggleConsultationSelection = (id: string) => {
    const newSelection = new Set(selectedConsultations)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedConsultations(newSelection)
  }

  const toggleAllConsultations = () => {
    if (selectedConsultations.size === consultations.length) {
      setSelectedConsultations(new Set())
    } else {
      setSelectedConsultations(new Set(consultations.map(c => c.id)))
    }
  }

  const handleDeleteConsultations = async () => {
    if (selectedConsultations.size === 0) return

    if (window.confirm(`Tem certeza que deseja excluir ${selectedConsultations.size} consulta(s)? Esta ação não pode ser desfeita.`)) {
      try {
        const response = await fetch('/api/admin/consultations/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedConsultations) }),
        })
        if (!response.ok) {
          throw new Error('Erro ao excluir consultas')
        }
        setSelectedConsultations(new Set())
        fetchConsultations()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  // Professional handlers
  const toggleProfessionalSelection = (id: string) => {
    const newSelection = new Set(selectedProfessionals)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedProfessionals(newSelection)
  }

  const toggleAllProfessionals = () => {
    if (selectedProfessionals.size === professionals.length) {
      setSelectedProfessionals(new Set())
    } else {
      setSelectedProfessionals(new Set(professionals.map(p => p.id)))
    }
  }

  const handleDeleteProfessionals = async () => {
    if (selectedProfessionals.size === 0) return

    if (window.confirm(`Tem certeza que deseja excluir ${selectedProfessionals.size} profissional(is)? Esta ação não pode ser desfeita.`)) {
      try {
        const response = await fetch('/api/admin/professionals/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedProfessionals) }),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao excluir profissionais')
        }
        setSelectedProfessionals(new Set())
        fetchProfessionals()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  // Specialty handlers
  const handleCreateSpecialty = () => {
    setEditingSpecialty(null)
    setIsSpecialtyFormOpen(true)
  }

  const handleEditSpecialty = (specialty: SpecialtyWithCount) => {
    setEditingSpecialty(specialty)
    setIsSpecialtyFormOpen(true)
  }

  const handleDeleteSpecialty = async (specialtyId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta especialidade?')) {
      try {
        const response = await fetch(`/api/specialties/${specialtyId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao excluir especialidade')
        }
        fetchSpecialties()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  const handleSpecialtyFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const specialtyData = Object.fromEntries(formData.entries())

    try {
      const url = editingSpecialty ? `/api/specialties/${editingSpecialty.id}` : '/api/specialties'
      const method = editingSpecialty ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(specialtyData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || (editingSpecialty ? 'Erro ao atualizar especialidade' : 'Erro ao criar especialidade'))
      }

      setIsSpecialtyFormOpen(false)
      fetchSpecialties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  // Category handlers
  const handleCreateCategory = () => {
    setEditingCategory(null)
    setIsCategoryFormOpen(true)
  }

  const handleEditCategory = (category: FileCategory) => {
    setEditingCategory(category)
    setIsCategoryFormOpen(true)
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        const response = await fetch(`/api/file-categories/${categoryId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao excluir categoria')
        }
        fetchFileCategories()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  const handleCategoryFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const categoryData = Object.fromEntries(formData.entries())

    try {
      const url = editingCategory ? `/api/file-categories/${editingCategory.id}` : '/api/file-categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || (editingCategory ? 'Erro ao atualizar categoria' : 'Erro ao criar categoria'))
      }

      setIsCategoryFormOpen(false)
      fetchFileCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  // Clinic handlers
  const handleCreateClinic = () => {
    setEditingClinic(null)
    setIsClinicFormOpen(true)
  }

  const handleEditClinic = (clinic: ClinicWithCount) => {
    setEditingClinic(clinic)
    setIsClinicFormOpen(true)
  }

  const handleDeleteClinic = async (clinicId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta clínica?')) {
      try {
        const response = await fetch(`/api/clinics/${clinicId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao excluir clínica')
        }
        fetchClinics()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    }
  }

  const handleClinicFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const clinicData = Object.fromEntries(formData.entries())

    try {
      const url = editingClinic ? `/api/clinics/${editingClinic.id}` : '/api/clinics'
      const method = editingClinic ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clinicData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || (editingClinic ? 'Erro ao atualizar clínica' : 'Erro ao criar clínica'))
      }

      setIsClinicFormOpen(false)
      fetchClinics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Usuários
            </button>
            <button
              onClick={() => setActiveTab('consultations')}
              className={`${
                activeTab === 'consultations'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Consultas ({consultations.length})
            </button>
            <button
              onClick={() => setActiveTab('professionals')}
              className={`${
                activeTab === 'professionals'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Profissionais ({professionals.length})
            </button>
            <button
              onClick={() => setActiveTab('specialties')}
              className={`${
                activeTab === 'specialties'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Especialidades ({specialties.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`${
                activeTab === 'categories'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Categorias ({fileCategories.length})
            </button>
            <button
              onClick={() => setActiveTab('clinics')}
              className={`${
                activeTab === 'clinics'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Clínicas ({clinics.length})
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`${
                activeTab === 'files'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Arquivos ({files.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Gerenciamento de Usuários</h2>
          <button
            onClick={handleCreateUser}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Novo Usuário
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEditUser(user)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                  <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Consultations Tab */}
      {activeTab === 'consultations' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gerenciamento de Consultas</h2>
            {selectedConsultations.size > 0 && (
              <button
                onClick={handleDeleteConsultations}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Excluir ({selectedConsultations.size})
              </button>
            )}
          </div>

          {consultationsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando consultas...</div>
            </div>
          ) : consultations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma consulta encontrada</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedConsultations.size === consultations.length}
                        onChange={toggleAllConsultations}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissional
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arquivos
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultations.map((consultation) => (
                    <tr key={consultation.id} className={selectedConsultations.has(consultation.id) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedConsultations.has(consultation.id)}
                          onChange={() => toggleConsultationSelection(consultation.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(consultation.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{consultation.user.name}</div>
                        <div className="text-sm text-gray-500">{consultation.user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{consultation.professional.name}</div>
                        <div className="text-sm text-gray-500">
                          {consultation.professional.specialties.map(s => s.name).join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {consultation.files.length} arquivo(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`/consultations/${consultation.id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Editar
                        </a>
                        <a
                          href={`/consultations/${consultation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Ver detalhes
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Professionals Tab */}
      {activeTab === 'professionals' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gerenciamento de Profissionais</h2>
            {selectedProfessionals.size > 0 && (
              <button
                onClick={handleDeleteProfessionals}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Excluir ({selectedProfessionals.size})
              </button>
            )}
          </div>

          {professionalsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando profissionais...</div>
            </div>
          ) : professionals.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhum profissional encontrado</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProfessionals.size === professionals.length}
                        onChange={toggleAllProfessionals}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Especialidades
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CRM
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Consultas
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {professionals.map((professional) => (
                    <tr key={professional.id} className={selectedProfessionals.has(professional.id) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProfessionals.has(professional.id)}
                          onChange={() => toggleProfessionalSelection(professional.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {professional.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {professional.specialties.map((specialty) => (
                            <span
                              key={specialty.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {specialty.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {professional.crm || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {professional._count.consultations}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          professional.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {professional.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`/professionals/${professional.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver detalhes
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Specialties Tab */}
      {activeTab === 'specialties' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Especialidades Médicas</h2>
            <button
              onClick={handleCreateSpecialty}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Nova Especialidade
            </button>
          </div>

          {specialtiesLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando especialidades...</div>
            </div>
          ) : specialties.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma especialidade cadastrada</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissionais
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {specialties.map((specialty) => (
                    <tr key={specialty.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {specialty.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {specialty._count?.professionals || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditSpecialty(specialty)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteSpecialty(specialty.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Specialty Form Modal */}
      {isSpecialtyFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSpecialty ? 'Editar Especialidade' : 'Nova Especialidade'}
            </h3>
            <form onSubmit={handleSpecialtyFormSubmit}>
              <div className="mb-4">
                <label htmlFor="specialty-name" className="block text-sm font-medium text-gray-700">
                  Nome *
                </label>
                <input
                  type="text"
                  id="specialty-name"
                  name="name"
                  required
                  defaultValue={editingSpecialty?.name || ''}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSpecialtyFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingSpecialty ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Categorias de Arquivo</h2>
            <button
              onClick={handleCreateCategory}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Nova Categoria
            </button>
          </div>

          {categoriesLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando categorias...</div>
            </div>
          ) : fileCategories.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma categoria cadastrada</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arquivos
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fileCategories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {category._count?.files || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Category Form Modal */}
      {isCategoryFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>
            <form onSubmit={handleCategoryFormSubmit}>
              <div className="mb-4">
                <label htmlFor="category-name" className="block text-sm font-medium text-gray-700">
                  Nome *
                </label>
                <input
                  type="text"
                  id="category-name"
                  name="name"
                  required
                  defaultValue={editingCategory?.name || ''}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingCategory ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinics Tab */}
      {activeTab === 'clinics' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Clínicas e Hospitais</h2>
            <button
              onClick={handleCreateClinic}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Nova Clínica
            </button>
          </div>

          {clinicsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando clínicas...</div>
            </div>
          ) : clinics.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhuma clínica cadastrada</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissionais
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clinics.map((clinic) => (
                    <tr key={clinic.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {clinic.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {clinic._count?.professionals || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditClinic(clinic)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteClinic(clinic.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Clinic Form Modal */}
      {isClinicFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingClinic ? 'Editar Clínica' : 'Nova Clínica'}
            </h3>
            <form onSubmit={handleClinicFormSubmit}>
              <div className="mb-4">
                <label htmlFor="clinic-name" className="block text-sm font-medium text-gray-700">
                  Nome *
                </label>
                <input
                  type="text"
                  id="clinic-name"
                  name="name"
                  required
                  defaultValue={editingClinic?.name || ''}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsClinicFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingClinic ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Gerenciamento de Arquivos</h2>
            <div className="text-sm text-gray-600">
              Total: {files.length} arquivo{files.length !== 1 ? 's' : ''}
            </div>
          </div>

          {filesLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando arquivos...</div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Nenhum arquivo encontrado</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arquivo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Consulta
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissional
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Upload
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {file.mimeType.startsWith('image/') ? (
                              <img
                                src={`/api/files/${file.path}`}
                                alt={file.filename}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{file.filename}</div>
                            <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {file.category ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {file.category.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Sem categoria</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`/consultations/${file.consultation.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          {formatDate(file.consultation.date)}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{file.consultation.user.name}</div>
                        <div className="text-sm text-gray-500">{file.consultation.user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{file.professional.name}</div>
                        <div className="text-sm text-gray-500">
                          {file.professional.specialties.map(s => s.name).join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(file.uploadedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`/api/files/${file.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Visualizar
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file.path)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome</label>
                <input type="text" name="name" id="name" defaultValue={editingUser?.name} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" name="email" id="email" defaultValue={editingUser?.email} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required />
              </div>
              <div className="mb-4">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                <select name="role" id="role" defaultValue={editingUser?.role} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">{editingUser ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
