'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme/context'
import { useEffect, useState } from 'react'

export function Navigation() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { theme, setTheme, isLoading } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Consultas', href: '/consultations' },
    { name: 'Profissionais', href: '/professionals' },
    { name: 'Clínicas', href: '/clinics' },
    { name: 'Arquivos', href: '/files' },
  ]

  const adminNavigation = [
    { name: 'Administração', href: '/admin' },
  ]

  if (status === 'loading') {
    return (
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Image
                src="/doctor-icon.png"
                alt="MedLog"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">MedLog</span>
            </Link>
            <div className="text-sm text-gray-500 dark:text-gray-400">Carregando...</div>
          </div>
        </div>
      </nav>
    )
  }

  if (!mounted) {
    return (
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16" />
        </div>
      </nav>
    )
  }

  const toggleTheme = async () => {
    try {
      if (theme === 'light') {
        await setTheme('dark')
      } else if (theme === 'dark') {
        await setTheme('system')
      } else {
        await setTheme('light')
      }
    } catch (error) {
      console.error('Failed to toggle theme:', error)
    }
  }

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href={session ? "/dashboard" : "/"} className="flex items-center space-x-2">
              <Image
                src="/doctor-icon.png"
                alt="MedLog"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">MedLog</span>
            </Link>

            {session && (
              <div className="hidden md:flex space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === item.href
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}

                {session.user.role === 'ADMIN' && adminNavigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === item.href
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {session && !isLoading && (
              <button
                onClick={toggleTheme}
                title={`Tema atual: ${theme}`}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === 'light' && <span>🌙</span>}
                {theme === 'dark' && <span>☀️</span>}
                {theme === 'system' && <span>🖥️</span>}
              </button>
            )}

            {session && (
              <Link
                href="/settings"
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Configurações"
              >
                ⚙️
              </Link>
            )}

            {session ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}