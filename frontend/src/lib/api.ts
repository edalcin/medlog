// Shared data types matching Go backend models
export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
}

export interface Specialty {
  id: string
  name: string
}

export interface FileCategory {
  id: string
  name: string
}

export interface Clinic {
  id: string
  name: string
  address?: string
}

export interface Professional {
  id: string
  name: string
  crm?: string
  notes?: string
  isActive: boolean
  userId?: string
  clinicId?: string
  clinic?: Clinic
  specialties: Specialty[]
}

export interface MedFile {
  id: string
  filename: string
  customName?: string
  mimeType: string
  size: number
  consultationId?: string
  professionalId?: string
  categories: FileCategory[]
}

export interface Consultation {
  id: string
  date: string
  proposito?: string
  notes?: string
  type: string
  rating?: number
  userId: string
  professionalId?: string
  professional?: Professional
  files: MedFile[]
}

export interface AdminStats {
  users: number
  consultations: number
  professionals: number
  files: number
}

// Base API path — same origin, proxied in dev
const BASE = '/api'

// Core request helper — throws Error with server message on non-2xx
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status })
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Auth endpoints
export const signin = (email: string, password: string) =>
  request<User>('POST', '/auth/signin', { email, password })

export const signout = () =>
  request<{ ok: boolean }>('POST', '/auth/signout')

export const me = () =>
  request<User>('GET', '/auth/me')

// Consultations
export const getConsultations = () =>
  request<{ data: Consultation[] }>('GET', '/consultations')

export const createConsultation = (body: {
  date: string
  type: string
  proposito?: string
  notes?: string
  professionalId?: string
  rating?: number
}) => request<Consultation>('POST', '/consultations', body)

export const getConsultation = (id: string) =>
  request<Consultation>('GET', `/consultations/${id}`)

export const updateConsultation = (id: string, body: Partial<{
  date: string
  type: string
  proposito: string
  notes: string
  professionalId: string
  rating: number
}>) => request<Consultation>('PUT', `/consultations/${id}`, body)

export const deleteConsultation = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/consultations/${id}`)

// Professionals
export const getProfessionals = (activeOnly = false) =>
  request<{ data: Professional[] }>('GET', `/professionals${activeOnly ? '?active=true' : ''}`)

export const createProfessional = (body: {
  name: string
  notes?: string
  isActive: boolean
  specialtyIds: string[]
  clinicId?: string
}) => request<Professional>('POST', '/professionals', body)

export const getProfessional = (id: string) =>
  request<Professional>('GET', `/professionals/${id}`)

export const updateProfessional = (id: string, body: Partial<{
  name: string
  crm: string
  notes: string
  isActive: boolean
  specialtyIds: string[]
  clinicId: string
}>) => request<Professional>('PUT', `/professionals/${id}`, body)

export const deleteProfessional = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/professionals/${id}`)

// Files
export const uploadFile = (
  file: File,
  consultationId: string,
  professionalId?: string,
  categoryIds: string[] = []
) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('consultationId', consultationId)
  if (professionalId) fd.append('professionalId', professionalId)
  categoryIds.forEach(id => fd.append('categoryIds[]', id))
  return fetch(BASE + '/files', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status })
    }
    return res.json() as Promise<MedFile>
  })
}

export const deleteFile = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/files/${id}`)

// Specialties dictionary
export const getSpecialties = () =>
  request<{ data: Specialty[] }>('GET', '/specialties')

export const createSpecialty = (name: string) =>
  request<Specialty>('POST', '/specialties', { name })

export const updateSpecialty = (id: string, name: string) =>
  request<Specialty>('PUT', `/specialties/${id}`, { name })

export const deleteSpecialty = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/specialties/${id}`)

// File categories dictionary
export const getCategories = () =>
  request<{ data: FileCategory[] }>('GET', '/file-categories')

export const createCategory = (name: string) =>
  request<FileCategory>('POST', '/file-categories', { name })

export const updateCategory = (id: string, name: string) =>
  request<FileCategory>('PUT', `/file-categories/${id}`, { name })

export const deleteCategory = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/file-categories/${id}`)

// Clinics dictionary
export const getClinics = () =>
  request<{ data: Clinic[] }>('GET', '/clinics')

export const createClinic = (name: string) =>
  request<Clinic>('POST', '/clinics', { name })

export const updateClinic = (id: string, name: string) =>
  request<Clinic>('PUT', `/clinics/${id}`, { name })

export const deleteClinic = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/clinics/${id}`)

// Users (admin only)
export const getUsers = () =>
  request<{ data: User[] }>('GET', '/users')

export const createUser = (body: { email: string; password: string; name: string; role: 'ADMIN' | 'USER' }) =>
  request<User>('POST', '/users', body)

export const updateUser = (id: string, body: Partial<{ email: string; name: string; role: string; password: string }>) =>
  request<User>('PUT', `/users/${id}`, body)

export const deleteUser = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/users/${id}`)

// Admin endpoints
export const getAdminStats = () =>
  request<AdminStats>('GET', '/admin/stats')

export const getAdminConsultations = () =>
  request<{ data: Consultation[] }>('GET', '/admin/consultations')

export const bulkDeleteConsultations = (ids: string[]) =>
  request<{ deleted: number }>('DELETE', '/admin/consultations/bulk-delete', { ids })

export const getAdminProfessionals = () =>
  request<{ data: Professional[] }>('GET', '/admin/professionals')

export const bulkDeleteProfessionals = (ids: string[]) =>
  request<{ deleted: number }>('DELETE', '/admin/professionals/bulk-delete', { ids })

export const getAdminFiles = () =>
  request<{ data: MedFile[] }>('GET', '/admin/files')

// Returns raw Response so caller can trigger browser download
export const downloadBackup = () =>
  fetch(BASE + '/admin/backup', { credentials: 'include' })

export const restoreBackup = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(BASE + '/admin/restore', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw Object.assign(new Error(err.error || 'Restore failed'), { status: res.status })
    }
    return res.json()
  })
}
