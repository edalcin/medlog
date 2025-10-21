'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface FileWithAssociations {
  id: string
  filename: string
  customName: string | null
  path: string
  mimeType: string
  size: number
  uploadedAt: string
  categoryId: string | null
  category?: { id: string; name: string } | null
  consultation?: {
    id: string
    date: string
    professional?: { id: string; name: string } | null
  } | null
  professional?: { id: string; name: string } | null
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

export default function EditFilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const fileId = params.id as string

  const [file, setFile] = useState<FileWithAssociations | null>(null)
  const [categories, setCategories] = useState<FileCategory[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [customName, setCustomName] = useState('')
  const [categoryId, setCategory] = useState('')
  const [professionalId, setProfessional] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session, fileId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [fileRes, categoriesRes, professionalsRes] = await Promise.all([
        fetch(`/api/files/${fileId}`),
        fetch('/api/file-categories'),
        fetch('/api/professionals'),
      ])

      if (fileRes.ok) {
        const data = await fileRes.json()
        setFile(data.data)
        setCustomName(data.data.customName || '')
        setCategory(data.data.categoryId || '')
        setProfessional(data.data.professionalId || '')
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.data || [])
      }

      if (professionalsRes.ok) {
        const data = await professionalsRes.json()
        setProfessionals(data.data || [])
      }
    } catch (err) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customName && !categoryId && !professionalId) {
      setError('Preencha pelo menos um campo')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customName: customName || null,
          categoryId: categoryId || null,
          professionalId: professionalId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/files')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/files/${fileId}/delete`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar')
      }

      // Close modal and redirect
      setShowDeleteConfirm(false)
      router.push('/files')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setShowDeleteConfirm(false)
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!session || !file) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/files" className="text-blue-600 hover:text-blue-800 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Editar Arquivo</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">✓ Arquivo atualizado com sucesso! Redirecionando...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* File Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="font-semibold text-gray-900 mb-2">Arquivo</h2>
          <p className="text-sm text-gray-600">{file.filename}</p>
          <p className="text-xs text-gray-500 mt-1">
            {(file.size / 1024 / 1024).toFixed(2)} MB • {file.mimeType}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Custom Name */}
          <div>
            <label htmlFor="customName" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Personalizado
            </label>
            <input
              type="text"
              id="customName"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Deixe em branco para usar o nome do arquivo"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Professional Association */}
          <div>
            <label htmlFor="professional" className="block text-sm font-medium text-gray-700 mb-1">
              Associar a Profissional
            </label>
            <select
              id="professional"
              value={professionalId}
              onChange={(e) => setProfessional(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Nenhum --</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name} ({prof.specialties.map(s => s.name).join(', ')})
                </option>
              ))}
            </select>
            {file.consultation && (
              <p className="text-xs text-blue-600 mt-1">
                ℹ️ Este arquivo está associado à consulta do prof. {file.consultation.professional?.name}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Nenhuma --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Associations */}
          {(file.consultation || file.professional) && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900 mb-2">Associações Atuais:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                {file.consultation && (
                  <li>• Consulta: {new Date(file.consultation.date).toLocaleDateString('pt-BR')}</li>
                )}
                {file.professional && (
                  <li>• Profissional: {file.professional.name}</li>
                )}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-red-700"
            >
              Deletar
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Deleção</h2>

            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                Tem certeza que deseja deletar este arquivo?
              </p>
              <p className="text-sm text-gray-500 font-mono bg-gray-50 p-2 rounded">
                {file.customName || file.filename}
              </p>
            </div>

            {file.consultation && (
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
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Deletando...' : 'Sim, Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
