'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'

interface FileCategory {
  id: string
  name: string
}

interface Professional {
  id: string
  name: string
  specialties: Array<{ name: string }>
}

export default function NewFilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [categories, setCategories] = useState<FileCategory[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [customName, setCustomName] = useState('')
  const [categoryId, setCategory] = useState('')
  const [professionalId, setProfessional] = useState('')
  const [fileHash, setFileHash] = useState<string | null>(null)
  const [hashCalculating, setHashCalculating] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [categoriesRes, professionalsRes] = await Promise.all([
        fetch('/api/file-categories'),
        fetch('/api/professionals'),
      ])

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

  const calculateHash = async (file: File) => {
    setHashCalculating(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      setFileHash(hashHex)
      return hashHex
    } catch (err) {
      console.error('Erro ao calcular hash:', err)
      setError('Erro ao validar arquivo')
      return null
    } finally {
      setHashCalculating(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setCustomName(selectedFile.name.replace(/\.[^.]*$/, ''))
      await calculateHash(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setError('Selecione um arquivo')
      return
    }

    if (!professionalId && !categoryId) {
      setError('Associe pelo menos um profissional ou selecione uma categoria')
      return
    }

    if (!fileHash) {
      setError('Aguarde o cálculo do hash do arquivo')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customName', customName)
      if (categoryId) formData.append('categoryId', categoryId)
      if (professionalId) formData.append('professionalId', professionalId)
      formData.append('hash', fileHash)

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload')
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/files" className="text-blue-600 hover:text-blue-800 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Novo Arquivo</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">✓ Arquivo enviado com sucesso! Redirecionando...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
              <input
                type="file"
                onChange={handleFileChange}
                disabled={submitting}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                {file ? (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="mt-2 text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {hashCalculating && (
                      <p className="text-xs text-blue-600 mt-1">Calculando hash...</p>
                    )}
                    {fileHash && !hashCalculating && (
                      <p className="text-xs text-green-600 mt-1">Hash calculado ✓</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      Clique para selecionar ou arraste um arquivo
                    </p>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG até 10MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

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
              <option value="">-- Opcional --</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name} ({prof.specialties.map(s => s.name).join(', ')})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Associe o arquivo a um profissional para organizá-lo melhor
            </p>
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
              <option value="">-- Selecione --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Buttons */}
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
              disabled={submitting || !file || hashCalculating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Arquivo'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Nota:</strong> O arquivo será validado para detecção de duplicatas. Se um arquivo idêntico já existir, você será notificado.
          </p>
        </div>
      </div>
    </div>
  )
}
