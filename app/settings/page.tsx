'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/theme/context'
import Link from 'next/link'

interface UserSettings {
  id: string
  name: string
  email: string
  theme: string
}

interface User {
  id: string
  name: string
  email: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const { theme: currentTheme, setTheme } = useTheme()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('personal')

  // Personal data form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Sharing settings
  const [professionalsSharing, setProfessionalsSharing] = useState<string[]>([])
  const [clinicsSharing, setClinicsSharingState] = useState<string[]>([])
  const [savingSharing, setSavingSharing] = useState(false)

  // Load user settings
  useEffect(() => {
    if (status === 'unauthenticated') {
      return
    }

    const loadSettings = async () => {
      try {
        setLoading(true)
        const [settingsRes, usersRes, profSharingRes, clinicSharingRes] = await Promise.all([
          fetch('/api/users/settings'),
          fetch('/api/users/all'),
          fetch('/api/users/settings/sharing/professionals'),
          fetch('/api/users/settings/sharing/clinics'),
        ])

        if (!settingsRes.ok) throw new Error('Failed to load settings')
        if (!usersRes.ok) throw new Error('Failed to load users')

        const settingsData = await settingsRes.json()
        const usersData = await usersRes.json()

        setSettings(settingsData.data)
        setFormData((prev) => ({
          ...prev,
          name: settingsData.data.name,
          email: settingsData.data.email,
        }))
        setAllUsers(usersData.data || [])

        if (profSharingRes.ok) {
          const profData = await profSharingRes.json()
          setProfessionalsSharing(profData.data?.sharingWith?.map((u: User) => u.id) || [])
        }

        if (clinicSharingRes.ok) {
          const clinicData = await clinicSharingRes.json()
          setClinicsSharingState(clinicData.data?.sharingWith?.map((u: User) => u.id) || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar configurações')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [status])

  const handlePersonalDataSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    try {
      const response = await fetch('/api/users/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          ...(formData.newPassword && {
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
          }),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao atualizar dados')
      }

      setSuccess('Dados atualizados com sucesso!')
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar dados')
    }
  }

  const handleThemeChange = async (newTheme: string) => {
    try {
      await setTheme(newTheme as 'light' | 'dark' | 'system')
      setSuccess('Tema atualizado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tema')
    }
  }

  const handleProfessionalsShareChange = (userId: string, checked: boolean) => {
    if (checked) {
      setProfessionalsSharing((prev) => [...prev, userId])
    } else {
      setProfessionalsSharing((prev) => prev.filter((id) => id !== userId))
    }
  }

  const handleClinicsShareChange = (userId: string, checked: boolean) => {
    if (checked) {
      setClinicsSharingState((prev) => [...prev, userId])
    } else {
      setClinicsSharingState((prev) => prev.filter((id) => id !== userId))
    }
  }

  const saveSharingSettings = async () => {
    setSavingSharing(true)
    setError('')
    setSuccess('')

    try {
      const [profRes, clinicRes] = await Promise.all([
        fetch('/api/users/settings/sharing/professionals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: professionalsSharing }),
        }),
        fetch('/api/users/settings/sharing/clinics', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: clinicsSharing }),
        }),
      ])

      if (!profRes.ok || !clinicRes.ok) {
        throw new Error('Erro ao atualizar compartilhamentos')
      }

      setSuccess('Compartilhamentos atualizados com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar compartilhamentos')
    } finally {
      setSavingSharing(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Você precisa estar autenticado para acessar esta página.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-600 dark:text-gray-400">Gerencie suas configurações pessoais</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8">
          {['personal', 'theme', 'sharing'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab === 'personal' && 'Dados Pessoais'}
              {tab === 'theme' && 'Tema'}
              {tab === 'sharing' && 'Compartilhamento'}
            </button>
          ))}
        </div>
      </div>

      {/* Personal Data Tab */}
      {activeTab === 'personal' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Dados Pessoais
          </h2>
          <form onSubmit={handlePersonalDataSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nome
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <hr className="dark:border-gray-700" />

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Mudar Senha
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                Sair
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Tema da Aplicação
          </h2>

          <div className="space-y-4">
            {['light', 'dark', 'system'].map((themeOption) => (
              <label key={themeOption} className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input
                  type="radio"
                  name="theme"
                  value={themeOption}
                  checked={currentTheme === themeOption}
                  onChange={() => handleThemeChange(themeOption)}
                  className="w-4 h-4"
                />
                <span className="ml-3 flex-1">
                  <span className="block font-medium text-gray-900 dark:text-white">
                    {themeOption === 'light' && 'Claro'}
                    {themeOption === 'dark' && 'Escuro'}
                    {themeOption === 'system' && 'Sistema'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {themeOption === 'light' && 'Sempre usar tema claro'}
                    {themeOption === 'dark' && 'Sempre usar tema escuro'}
                    {themeOption === 'system' && 'Seguir preferência do sistema operacional'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sharing Tab */}
      {activeTab === 'sharing' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Compartilhamento de Dados
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Escolha com quais usuários do sistema você deseja compartilhar seus profissionais e clínicas.
          </p>

          {allUsers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">Nenhum outro usuário disponível</p>
          ) : (
            <div className="space-y-8">
              {/* Professionals Sharing */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Compartilhar Profissionais
                </h3>
                <div className="space-y-3">
                  {allUsers.map((user) => (
                    <label key={user.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={professionalsSharing.includes(user.id)}
                        onChange={(e) =>
                          handleProfessionalsShareChange(user.id, e.target.checked)
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="ml-3 flex-1">
                        <span className="block font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Clinics Sharing */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Compartilhar Clínicas
                </h3>
                <div className="space-y-3">
                  {allUsers.map((user) => (
                    <label key={user.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={clinicsSharing.includes(user.id)}
                        onChange={(e) =>
                          handleClinicsShareChange(user.id, e.target.checked)
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="ml-3 flex-1">
                        <span className="block font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={saveSharingSettings}
                disabled={savingSharing}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400"
              >
                {savingSharing ? 'Salvando...' : 'Salvar Compartilhamentos'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
