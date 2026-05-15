import { writable, derived } from 'svelte/store'
import * as api from './api'
import type { User } from './api'

// Reactive auth state using Svelte stores (compatible with .ts files)
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
