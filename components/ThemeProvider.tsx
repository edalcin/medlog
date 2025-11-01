'use client'

import { ReactNode, useEffect, useState } from 'react'
import { ThemeContext, type ThemeMode } from '@/lib/theme/context'

interface ThemeProviderProps {
  children: ReactNode
  initialTheme?: ThemeMode
}

export function ThemeProvider({ children, initialTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [isLoading, setIsLoading] = useState(true)

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/users/settings/theme')
        if (response.ok) {
          const data = await response.json()
          const savedTheme = (data.data?.theme?.toLowerCase() || 'system') as ThemeMode
          setThemeState(savedTheme)
          applyTheme(savedTheme)
        } else {
          applyTheme('system')
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
        applyTheme('system')
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [])

  const applyTheme = (selectedTheme: ThemeMode) => {
    const isDark = getIsDark(selectedTheme)
    setResolvedTheme(isDark ? 'dark' : 'light')

    const htmlElement = document.documentElement
    if (isDark) {
      htmlElement.classList.add('dark')
    } else {
      htmlElement.classList.remove('dark')
    }
  }

  const getIsDark = (selectedTheme: ThemeMode): boolean => {
    if (selectedTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return selectedTheme === 'dark'
  }

  const setTheme = async (newTheme: ThemeMode) => {
    try {
      const response = await fetch('/api/users/settings/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme.toUpperCase() }),
      })

      if (!response.ok) {
        throw new Error('Failed to update theme')
      }

      setThemeState(newTheme)
      applyTheme(newTheme)
    } catch (error) {
      console.error('Failed to update theme:', error)
      throw error
    }
  }

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
