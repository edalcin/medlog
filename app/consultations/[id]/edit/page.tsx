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
  isActive: boolean
}

interface FileCategory {
  id: string
  name: string
}

interface ExistingFile {
  id: string
  filename: string
  path: string
  customName?: string | null
  mimeType: string
  size: number
  uploadedAt: string
  category?: {
    id: string
    name: string
  } | null
}

interface FileWithCategory {
  file: File
  customName: string
  categoryId: string
  newCategoryName: string
}

interface Consultation {
  id: string
  date: string
  proposito: string | null
  notes: string | null
  professionalId: string
  files: ExistingFile[]
}

export default function EditConsultationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [categories, setCategories] = useState<FileCategory[]>([])
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    date: '',
    professionalId: '',
    proposito: '',
    notes: '',
  })

  // File management states
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<FileWithCategory[]>([])
  const [editingFile, setEditingFile] = useState<ExistingFile | null>(null)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)

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
      setExistingFiles(consultationData.files || [])

      // Format date for input[type="date"]
      const dateObj = new Date(consultationData.date)
      const formattedDate = dateObj.toISOString().split('T')[0]

      setFormData({
        date: formattedDate,
        professionalId: consultationData.professionalId,
        proposito: consultationData.proposito || '',
        notes: consultationData.notes || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }, [id])

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals?status=all')
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

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/file-categories')
      if (!response.ok) {
        throw new Error('Erro ao carregar categorias')
      }
      const data = await response.json()
      setCategories(data.data)
    } catch (err) {
      console.error('Erro ao carregar categorias:', err)
    }
  }

  useEffect(() => {
    if (session && id) {
      fetchConsultation()
      fetchProfessionals()
      fetchCategories()
    }
  }, [session, id, fetchConsultation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Update consultation data
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

      // Upload new files if any
      if (selectedFiles.length > 0) {
        for (const fileWithCat of selectedFiles) {
          const fileFormData = new FormData()
          fileFormData.append('file', fileWithCat.file)
          fileFormData.append('consultationId', id as string)

          if (fileWithCat.customName && fileWithCat.customName !== fileWithCat.file.name) {
            fileFormData.append('customName', fileWithCat.customName)
          }

          if (fileWithCat.categoryId === 'new' && fileWithCat.newCategoryName) {
            fileFormData.append('newCategoryName', fileWithCat.newCategoryName)
          } else if (fileWithCat.categoryId && fileWithCat.categoryId !== 'new') {
            fileFormData.append('categoryId', fileWithCat.categoryId)
          }

          const fileResponse = await fetch('/api/files/upload', {
            method: 'POST',
            body: fileFormData,
          })

          if (!fileResponse.ok) {
            console.error(`Erro ao enviar arquivo ${fileWithCat.file.name}`)
          }
        }
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

  // File handling functions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      const newFiles = filesArray.map(file => ({
        file,
        customName: file.name,
        categoryId: '',
        newCategoryName: '',
      }))
      setSelectedFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeNewFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateFileCategory = (index: number, categoryId: string) => {
    setSelectedFiles(prev => prev.map((item, i) =>
      i === index ? { ...item, categoryId, newCategoryName: '' } : item
    ))
  }

  const updateFileNewCategory = (index: number, newCategoryName: string) => {
    setSelectedFiles(prev => prev.map((item, i) =>
      i === index ? { ...item, newCategoryName } : item
    ))
  }

  const updateFileCustomName = (index: number, customName: string) => {
    setSelectedFiles(prev => prev.map((item, i) =>
      i === index ? { ...item, customName } : item
    ))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleEditExistingFile = (file: ExistingFile) => {
    setEditingFile(file)
  }

  const handleSaveFileEdit = async () => {
    if (!editingFile) return

    try {
      const response = await fetch(`/api/files/edit/${editingFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customName: editingFile.customName,
          categoryId: editingFile.category?.id || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar arquivo')
      }

      // Update local state
      setExistingFiles(prev => prev.map(f =>
        f.id === editingFile.id ? editingFile : f
      ))
      setEditingFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar arquivo')
    }
  }

  const handleDeleteFile = async (filePath: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) {
      return
    }

    try {
      const response = await fetch(`/api/files/${filePath}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir arquivo')
      }

      // Remove from local state
      setExistingFiles(prev => prev.filter(f => f.path !== filePath))
      setFileToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir arquivo')
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
                  {!professional.isActive && ' [INATIVO]'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="proposito" className="block text-sm font-medium text-gray-700">
              Propósito da Consulta
            </label>
            <input
              type="text"
              id="proposito"
              name="proposito"
              value={formData.proposito}
              onChange={handleInputChange}
              placeholder="Ex: Consulta de rotina, Retorno, Exame, etc."
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
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

          {/* Existing Files Section */}
          {existingFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arquivos Existentes
              </label>
              <div className="space-y-2">
                {existingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <svg
                            className="flex-shrink-0 h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.customName || file.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                              {file.category && (
                                <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                  {file.category.name}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-3 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditExistingFile(file)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                          Editar
                        </button>
                        <a
                          href={`/api/files/${file.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Ver
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.path)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Files Section */}
          <div>
            <label htmlFor="files" className="block text-sm font-medium text-gray-700">
              Adicionar Novos Arquivos
            </label>
            <div className="mt-1">
              <input
                type="file"
                id="files"
                name="files"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              <p className="mt-1 text-sm text-gray-500">
                Anexe receitas, laudos, exames (PDF, PNG, JPG - máx. 10MB por arquivo)
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Novos arquivos ({selectedFiles.length}):
                </p>
                {selectedFiles.map((fileWithCat, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <svg
                          className="flex-shrink-0 h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {fileWithCat.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(fileWithCat.file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="flex-shrink-0 ml-3 text-red-600 hover:text-red-800"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <div>
                      <label htmlFor={`customName-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
                        Nome para exibição
                      </label>
                      <input
                        type="text"
                        id={`customName-${index}`}
                        value={fileWithCat.customName}
                        onChange={(e) => updateFileCustomName(index, e.target.value)}
                        placeholder="Nome do arquivo"
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label htmlFor={`category-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
                          Categoria
                        </label>
                        <select
                          id={`category-${index}`}
                          value={fileWithCat.categoryId}
                          onChange={(e) => updateFileCategory(index, e.target.value)}
                          className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Sem categoria</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                          <option value="new">+ Nova categoria</option>
                        </select>
                      </div>
                      {fileWithCat.categoryId === 'new' && (
                        <div className="flex-1">
                          <label htmlFor={`newCategory-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
                            Nome da categoria
                          </label>
                          <input
                            type="text"
                            id={`newCategory-${index}`}
                            value={fileWithCat.newCategoryName}
                            onChange={(e) => updateFileNewCategory(index, e.target.value)}
                            placeholder="Nome da nova categoria"
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Edit File Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Editar Arquivo
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-customName" className="block text-sm font-medium text-gray-700">
                  Nome para exibição
                </label>
                <input
                  type="text"
                  id="edit-customName"
                  value={editingFile.customName || ''}
                  onChange={(e) => setEditingFile({ ...editingFile, customName: e.target.value })}
                  placeholder={editingFile.filename}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Nome original: {editingFile.filename}</p>
              </div>

              <div>
                <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="edit-category"
                  value={editingFile.category?.id || ''}
                  onChange={(e) => {
                    const selectedCategory = categories.find(c => c.id === e.target.value)
                    setEditingFile({
                      ...editingFile,
                      category: selectedCategory ? { id: selectedCategory.id, name: selectedCategory.name } : null
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveFileEdit}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
