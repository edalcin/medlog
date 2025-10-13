'use client'

import { useState, useEffect } from 'react'

interface File {
  id: number
  filename: string
  customName: string | null
  mimeType: string
  uploadedAt: string
  category: {
    id: number
    name: string
  } | null
  professional: {
    id: number
    name: string
  } | null
  consultation: {
    id: number
    date: string
    user: {
      id: number
      name: string
    }
  } | null
}

interface AssociateFilesModalProps {
  isOpen: boolean
  onClose: () => void
  onAssociate: (fileIds: number[]) => Promise<void>
  consultationId?: number
}

export default function AssociateFilesModal({
  isOpen,
  onClose,
  onAssociate,
  consultationId,
}: AssociateFilesModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [associating, setAssociating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchFiles()
    } else {
      setSelectedFiles(new Set())
      setSearch('')
    }
  }, [isOpen, search, consultationId])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (consultationId) params.set('consultationId', consultationId.toString())

      const response = await fetch(`/api/files/available?${params}`)
      const data = await response.json()

      if (data.success) {
        setFiles(data.data)
      }
    } catch (error) {
      console.error('Erro ao buscar arquivos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFile = (fileId: number) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  const handleAssociate = async () => {
    if (selectedFiles.size === 0) return

    setAssociating(true)
    try {
      await onAssociate(Array.from(selectedFiles))
      onClose()
    } catch (error) {
      console.error('Erro ao associar arquivos:', error)
    } finally {
      setAssociating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Associar Arquivos Existentes</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={associating}
            >
              ×
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Buscar por nome do arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Carregando arquivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum arquivo disponível</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <label
                  key={file.id}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFile(file.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-words">
                      {file.customName || file.filename}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 space-y-1">
                      {file.category && (
                        <div>Categoria: {file.category.name}</div>
                      )}
                      {file.professional && (
                        <div>Profissional: {file.professional.name}</div>
                      )}
                      {file.consultation && (
                        <div>
                          Consulta: {new Date(file.consultation.date).toLocaleDateString('pt-BR')} - {file.consultation.user.name}
                        </div>
                      )}
                      <div>
                        Enviado em: {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedFiles.size} arquivo(s) selecionado(s)
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={associating}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssociate}
              disabled={selectedFiles.size === 0 || associating}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {associating ? 'Associando...' : `Associar ${selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
