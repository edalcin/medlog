'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FileWithAssociations {
  id: string
  filename: string
  customName: string | null
  path: string
  mimeType: string
  size: number
  uploadedAt: string
  thumbnailPath?: string | null
  categories: Array<{
    category: {
      id: string
      name: string
    }
  }>
  consultation?: {
    id: string
    date: string
    proposito?: string | null
    professional?: {
      id: string
      name: string
    } | null
  } | null
  professional?: {
    id: string
    name: string
  } | null
}

interface FileCategory {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Array<{ name: string }>
}

export default function FilesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [files, setFiles] = useState<FileWithAssociations[]>([])
  const [filteredFiles, setFilteredFiles] = useState<FileWithAssociations[]>([])
  const [categories, setCategories] = useState<FileCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedProfessional, setSelectedProfessional] = useState('')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal state
  const [selectedFile, setSelectedFile] = useState<FileWithAssociations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit modal state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editCustomName, setEditCustomName] = useState('')
  const [editCategories, setEditCategories] = useState<Set<string>>(new Set())
  const [editProfessional, setEditProfessional] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchFiles()
      fetchCategories()
      fetchProfessionals()
    }
  }, [session])

  useEffect(() => {
    applyFiltersAndSort()
  }, [files, searchTerm, selectedCategory, selectedProfessional, sortBy, sortOrder])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/files/user')
      if (!response.ok) {
        throw new Error('Erro ao carregar arquivos')
      }
      const data = await response.json()
      setFiles(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/file-categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar categorias:', err)
    }
  }

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals')
      if (response.ok) {
        const data = await response.json()
        // Filtrar apenas profissionais ativos
        const activeProfs = (data.data || []).filter((p: any) => p.isActive).map((p: any) => ({
          id: p.id,
          name: p.name
        }))
        setProfessionals(activeProfs)
      }
    } catch (err) {
      console.error('Erro ao carregar profissionais:', err)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...files]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(f =>
        (f.customName || f.filename).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(f => f.categories?.some(cat => cat.category?.id === selectedCategory))
    }

    // Apply professional filter
    if (selectedProfessional) {
      filtered = filtered.filter(f => f.professional?.id === selectedProfessional)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = (a.customName || a.filename).localeCompare(b.customName || b.filename)
          break
        case 'date':
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
          break
        case 'size':
          comparison = a.size - b.size
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredFiles(filtered)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  const handleFileClick = (file: FileWithAssociations) => {
    setSelectedFile(file)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedFile(null)
    setShowDeleteConfirm(false)
    setIsEditMode(false)
    setEditCustomName('')
    setEditCategories(new Set())
    setEditProfessional('')
  }

  const handleEnterEditMode = () => {
    if (!selectedFile) return
    setEditCustomName(selectedFile.customName || '')
    setEditCategories(new Set(selectedFile.categories?.map(c => c.category.id) || []))
    setEditProfessional(selectedFile.professional?.id || '')
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditCustomName('')
    setEditCategories(new Set())
    setEditProfessional('')
  }

  const handleSaveEdit = async () => {
    if (!selectedFile) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/files/edit/${selectedFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customName: editCustomName || null,
          categoryIds: Array.from(editCategories),
          professionalId: editProfessional || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar alterações')
      }

      // Atualiza arquivo na lista
      const updatedFiles = files.map(f =>
        f.id === selectedFile.id ? { ...f, ...data.data } : f
      )
      setFiles(updatedFiles)
      setSelectedFile(data.data)
      setIsEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateThumbnail = async () => {
    if (!selectedFile) return

    setIsGeneratingThumbnail(true)
    try {
      const response = await fetch(`/api/files/generate-thumbnail/${selectedFile.id}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar thumbnail')
      }

      // Atualiza arquivo na lista
      const updatedFiles = files.map(f =>
        f.id === selectedFile.id ? { ...f, ...data.data } : f
      )
      setFiles(updatedFiles)
      setSelectedFile(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar thumbnail')
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  const handleDeleteFile = async () => {
    if (!selectedFile) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/delete`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar arquivo')
      }

      // Remove arquivo da lista
      setFiles(files.filter(f => f.id !== selectedFile.id))

      // Fecha modal e confirmação
      handleCloseModal()
      setShowDeleteConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar arquivo')
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Meus Arquivos</h1>
          <Link
            href="/files/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Arquivo
          </Link>
        </div>
        <p className="mt-2 text-gray-600">
          Total: {filteredFiles.length} arquivo(s)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome do arquivo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="professional" className="block text-sm font-medium text-gray-700 mb-1">
              Profissional
            </label>
            <select
              id="professional"
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-1">
              Ordenar por
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="name">Nome</option>
              <option value="date">Data</option>
              <option value="size">Tamanho</option>
            </select>
          </div>

          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
              Ordem
            </label>
            <select
              id="sortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
        </div>

        {(searchTerm || selectedCategory || selectedProfessional) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedCategory('')
              setSelectedProfessional('')
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Files Table */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-gray-500">Nenhum arquivo encontrado</p>
          <Link
            href="/files/new"
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Fazer upload de um arquivo
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome do Arquivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Associações
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamanho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {file.mimeType.startsWith('image/') ? (
                          <img
                            src={`/api/files/download/${file.path}`}
                            alt={file.customName || file.filename}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : file.mimeType === 'application/pdf' && file.thumbnailPath ? (
                          <img
                            src={`/api/files/thumbnail/${file.thumbnailPath}`}
                            alt={file.customName || file.filename}
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
                        <div className="text-sm font-medium text-gray-900">
                          {file.customName || file.filename}
                        </div>
                        {file.customName && (
                          <div className="text-xs text-gray-500">{file.filename}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {file.categories && file.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {file.categories.map((cat: any, idx: number) => (
                          <span key={idx} className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {cat.category?.name || cat.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="space-y-1">
                      {file.consultation && (
                        <div>Consulta: {formatDate(file.consultation.date)}</div>
                      )}
                      {file.professional && (
                        <div>Prof: {file.professional.name}</div>
                      )}
                      {!file.consultation && !file.professional && (
                        <div className="text-yellow-600">Sem associações</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(file.uploadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File Details/Edit Modal */}
      {isModalOpen && selectedFile && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEditMode ? 'Editar Arquivo' : 'Detalhes do Arquivo'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* File Preview */}
                <div
                  className="flex justify-center cursor-pointer group"
                  onClick={() => window.open(`/api/files/download/${selectedFile.path}`, '_blank')}
                >
                  {selectedFile.mimeType.startsWith('image/') ? (
                    <img
                      src={`/api/files/download/${selectedFile.path}`}
                      alt={selectedFile.customName || selectedFile.filename}
                      className="max-h-60 rounded group-hover:opacity-75 transition-opacity"
                      title="Clique para visualizar o arquivo"
                    />
                  ) : selectedFile.mimeType === 'application/pdf' && selectedFile.thumbnailPath ? (
                    <img
                      src={`/api/files/thumbnail/${selectedFile.thumbnailPath}`}
                      alt={selectedFile.customName || selectedFile.filename}
                      className="max-h-60 rounded group-hover:opacity-75 transition-opacity"
                      title="Clique para visualizar o arquivo"
                    />
                  ) : (
                    <div className="h-40 w-40 rounded bg-gray-200 flex items-center justify-center group-hover:bg-gray-300 transition-colors">
                      <svg className="h-20 w-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* File Information - Edit or View Mode */}
                {isEditMode ? (
                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Personalizado
                      </label>
                      <input
                        type="text"
                        value={editCustomName}
                        onChange={(e) => setEditCustomName(e.target.value)}
                        placeholder={selectedFile.filename}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Nome original: {selectedFile.filename}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categorias
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                        {categories.length === 0 ? (
                          <p className="text-xs text-gray-500">Nenhuma categoria disponível</p>
                        ) : (
                          categories.map((category) => (
                            <label key={category.id} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editCategories.has(category.id)}
                                onChange={(e) => {
                                  const newCategories = new Set(editCategories)
                                  if (e.target.checked) {
                                    newCategories.add(category.id)
                                  } else {
                                    newCategories.delete(category.id)
                                  }
                                  setEditCategories(newCategories)
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Profissional
                      </label>
                      <select
                        value={editProfessional}
                        onChange={(e) => setEditProfessional(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Nenhum --</option>
                        {professionals.map((prof) => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedFile.consultation && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <strong>ℹ️ Consulta Associada:</strong> {formatDate(selectedFile.consultation.date)}
                        </p>
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nome</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.customName || selectedFile.filename}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nome Original</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.filename}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Categorias</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedFile.categories && selectedFile.categories.length > 0
                          ? selectedFile.categories.map(cat => cat.category?.name).join(', ')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tamanho</label>
                      <p className="mt-1 text-sm text-gray-900">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data de Upload</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedFile.uploadedAt)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tipo MIME</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.mimeType}</p>
                    </div>
                  </div>
                )}

                {/* Associations - Only in View Mode */}
                {!isEditMode && (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Associações</h3>

                    {selectedFile.consultation && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Consulta Associada</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Data: {formatDate(selectedFile.consultation.date)}
                        </p>
                        {selectedFile.consultation.proposito && (
                          <p className="text-sm text-gray-600">
                            Propósito: {selectedFile.consultation.proposito}
                          </p>
                        )}
                        {selectedFile.consultation.professional && (
                          <p className="text-sm text-gray-600">
                            Profissional: {selectedFile.consultation.professional.name}
                          </p>
                        )}
                        <Link
                          href={`/consultations/${selectedFile.consultation.id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                        >
                          Ver Consulta →
                        </Link>
                      </div>
                    )}

                    {selectedFile.professional && !selectedFile.consultation && (
                      <div className="mb-4 p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Profissional Associado</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedFile.professional.name}
                        </p>
                        <Link
                          href={`/professionals/${selectedFile.professional.id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                        >
                          Ver Profissional →
                        </Link>
                      </div>
                    )}

                    {!selectedFile.consultation && !selectedFile.professional && (
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Este arquivo não possui associações. Clique em &quot;Editar&quot; para associá-lo.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 flex gap-2 flex-wrap">
                  {!isEditMode && (
                    <>
                      {(selectedFile.mimeType === 'application/pdf' || selectedFile.mimeType.startsWith('image/')) &&
                        !selectedFile.thumbnailPath && (
                        <button
                          onClick={handleGenerateThumbnail}
                          disabled={isGeneratingThumbnail}
                          className="flex-1 min-w-32 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                        >
                          {isGeneratingThumbnail ? 'Gerando...' : 'Gerar Thumbnail'}
                        </button>
                      )}

                      <button
                        onClick={handleEnterEditMode}
                        className="flex-1 min-w-32 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                      >
                        Editar
                      </button>

                      <a
                        href={`/api/files/download/${selectedFile.path}`}
                        download={selectedFile.customName || selectedFile.filename}
                        className="flex-1 min-w-32 inline-flex justify-center items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
                      >
                        Baixar
                      </a>

                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex-1 min-w-32 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                      >
                        Deletar
                      </button>
                    </>
                  )}

                  {isEditMode && (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="flex-1 min-w-32 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="flex-1 min-w-32 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedFile && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Deleção</h2>

            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                Tem certeza que deseja deletar este arquivo?
              </p>
              <p className="text-sm text-gray-500 font-mono bg-gray-50 p-2 rounded">
                {selectedFile.customName || selectedFile.filename}
              </p>
            </div>

            {selectedFile.consultation && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Aviso:</strong> Este arquivo está associado a uma consulta. A deleção não afetará a consulta.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteFile}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deletando...' : 'Sim, Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
