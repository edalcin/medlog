'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

interface FileCategory {
  id: string
  name: string
}

interface FileWithCategory {
  file: File
  customName: string
  categoryId: string
  newCategoryName: string
}

export default function NewConsultationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [categories, setCategories] = useState<FileCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    date: '',
    professionalId: '',
    notes: '',
  })
  const [selectedFiles, setSelectedFiles] = useState<FileWithCategory[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchProfessionals()
      fetchCategories()
    }
  }, [session])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // First, create the consultation
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar consulta')
      }

      const result = await response.json()
      const consultationId = result.data.id

      // Then, upload files if any
      if (selectedFiles.length > 0) {
        for (const fileWithCat of selectedFiles) {
          const fileFormData = new FormData()
          fileFormData.append('file', fileWithCat.file)
          fileFormData.append('consultationId', consultationId)

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

      router.push('/consultations')
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

  const removeFile = (index: number) => {
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
        <h1 className="text-3xl font-bold text-gray-900">Nova Consulta</h1>
        <p className="mt-2 text-gray-600">
          Registre uma nova consulta médica com os detalhes do atendimento.
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
            <p className="mt-1 text-sm text-gray-500">
              Não encontrou o profissional?{' '}
              <a href="/professionals/new" className="text-blue-600 hover:text-blue-500">
                Cadastre um novo
              </a>
            </p>
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

          <div>
            <label htmlFor="files" className="block text-sm font-medium text-gray-700">
              Documentos e Imagens
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
                  Arquivos selecionados ({selectedFiles.length}):
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
                        onClick={() => removeFile(index)}
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
              {submitting ? 'Salvando...' : 'Salvar Consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}