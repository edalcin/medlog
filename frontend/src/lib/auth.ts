import { writable, derived, get } from 'svelte/store'
import * as api from './api'
import type { User } from './api'

export const currentUser = writable<User | null>(null)
export const authLoading = writable(true)
export const isAdmin = derived(currentUser, $u => $u?.role === 'ADMIN')

export async function loadCurrentUser() {
  authLoading.set(true)
  try {
    const user = await api.me()
    currentUser.set(user)
  } catch {
    currentUser.set(null)
  } finally {
    authLoading.set(false)
  }
}

export async function signin(email: string, password: string) {
  const user = await api.signin(email, password)
  currentUser.set(user)
  return user
}

export async function signout() {
  await api.signout()
  currentUser.set(null)
}

export async function setTheme(theme: 'LIGHT' | 'DARK' | 'SYSTEM') {
  const user = get(currentUser)
  if (user) currentUser.set({ ...user, theme })
  try {
    await api.updateTheme(theme)
  } catch {
    // revert on failure
    if (user) currentUser.set(user)
  }
}
