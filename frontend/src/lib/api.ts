// Shared data types matching Go backend models
export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
  theme: 'SYSTEM' | 'LIGHT' | 'DARK'
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
  isShared: boolean
}

export interface ConsultationRef {
  id: string
  date: string
}

export interface Professional {
  id: string
  name: string
  crm?: string
  notes?: string
  isActive: boolean
  isShared: boolean
  userId?: string
  clinicId?: string
  clinic?: Clinic
  specialties: Specialty[]
  consultations: ConsultationRef[]
}

export interface MedFile {
  id: string
  filename: string
  customName?: string
  mimeType: string
  size: number
  consultationId?: string
  consultationDate?: string
  professionalId?: string
  userId?: string
  userName?: string
  professionalName?: string
  uploadedAt: string
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
  specialties: number
  clinics: number
  file_categories: number
}

export interface DashboardStats {
  summary: {
    totalConsultations: number
    totalEpisodes: number
    totalProfessionals: number
    totalFiles: number
  }
  bySpecialty: Array<{ name: string; count: number }>
  byClinic: Array<{ name: string; count: number }>
  byYear: Array<{ year: string; count: number }>
  byProfessional: Array<{ name: string; specialty: string; count: number }>
  byMonth: Array<{ month: string; count: number }>
  recentConsultations: Array<{
    id: string
    date: string
    professionalName: string
    specialty: string
  }>
  recentEpisodes: Array<{
    id: string
    date: string
    title: string
  }>
  topRatedProfessionals: Array<{
    id: string
    name: string
    specialty: string
    averageRating: number
    totalRatings: number
  }>
}

export interface PagedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
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
    signal: AbortSignal.timeout(30000),
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
  request<{ data: User }>('POST', '/auth/signin', { email, password }).then(r => r.data)

export const signout = () =>
  request<{ ok: boolean }>('POST', '/auth/signout')

export const me = () =>
  request<{ data: User }>('GET', '/auth/me').then(r => r.data)

// Dashboard
export const getDashboard = () =>
  request<{ data: DashboardStats }>('GET', '/dashboard').then(r => r.data)

// Consultations
export const getConsultations = (page = 1, limit = 20) =>
  request<PagedResponse<Consultation>>('GET', `/consultations?page=${page}&limit=${limit}`)

export const createConsultation = (body: {
  date: string
  type: string
  proposito?: string
  notes?: string
  professionalId?: string
  rating?: number
}) => request<{ data: Consultation }>('POST', '/consultations', body).then(r => r.data)

export const getConsultation = (id: string) =>
  request<{ data: Consultation }>('GET', `/consultations/${id}`).then(r => r.data)

export const updateConsultation = (id: string, body: Partial<{
  date: string
  type: string
  proposito: string
  notes: string
  professionalId: string
  rating: number
}>) => request<{ data: Consultation }>('PUT', `/consultations/${id}`, body).then(r => r.data)

export const deleteConsultation = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/consultations/${id}`)

// Professionals
export const getProfessionals = (activeOnly = false, page = 1, limit = 20, search = '', specialtyId = '', clinicId = '') => {
  let url = `/professionals?active=${activeOnly}&page=${page}&limit=${limit}`
  if (search) url += `&search=${encodeURIComponent(search)}`
  if (specialtyId) url += `&specialtyId=${encodeURIComponent(specialtyId)}`
  if (clinicId) url += `&clinicId=${encodeURIComponent(clinicId)}`
  return request<PagedResponse<Professional>>('GET', url)
}

export const createProfessional = (body: {
  name: string
  notes?: string
  isActive: boolean
  specialtyIds: string[]
  clinicId?: string
}) => request<{ data: Professional }>('POST', '/professionals', body).then(r => r.data)

export const getProfessional = (id: string) =>
  request<{ data: Professional }>('GET', `/professionals/${id}`).then(r => r.data)

export const updateProfessional = (id: string, body: Partial<{
  name: string
  crm: string
  notes: string
  isActive: boolean
  specialtyIds: string[]
  clinicId: string
}>) => request<{ data: Professional }>('PUT', `/professionals/${id}`, body).then(r => r.data)

export const deleteProfessional = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/professionals/${id}`)

// Files
export const uploadFile = (
  file: File,
  opts: {
    consultationId?: string
    professionalId?: string
    categoryIds?: string[]
    customName?: string
    ownerUserId?: string
  } = {}
) => {
  const fd = new FormData()
  fd.append('file', file)
  if (opts.consultationId) fd.append('consultationId', opts.consultationId)
  if (opts.professionalId) fd.append('professionalId', opts.professionalId)
  if (opts.customName) fd.append('customName', opts.customName)
  if (opts.ownerUserId) fd.append('ownerUserId', opts.ownerUserId)
  ;(opts.categoryIds ?? []).forEach(id => fd.append('categoryIds', id))
  return fetch(BASE + '/files', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status })
    }
    return (res.json() as Promise<{ data: MedFile }>).then(r => r.data)
  })
}

export const getMyFiles = (
  page = 1,
  limit = 20,
  opts: { sort?: string; dir?: string; categoryId?: string; professionalId?: string } = {}
) => {
  const p = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (opts.sort) p.set('sort', opts.sort)
  if (opts.dir) p.set('dir', opts.dir)
  if (opts.categoryId) p.set('categoryId', opts.categoryId)
  if (opts.professionalId) p.set('professionalId', opts.professionalId)
  return request<PagedResponse<MedFile>>('GET', `/files?${p}`)
}

export const updateFile = (
  id: string,
  body: {
    customName: string | null
    consultationId: string | null
    professionalId: string | null
    categoryIds: string[]
  }
) => request<{ data: MedFile }>('PATCH', `/files/${id}`, body).then(r => r.data)

export const deleteFile = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/files/${id}`)

// Specialties dictionary
export const getSpecialties = () =>
  request<{ data: Specialty[] }>('GET', '/specialties')

export const createSpecialty = (name: string) =>
  request<{ data: Specialty }>('POST', '/specialties', { name }).then(r => r.data)

export const updateSpecialty = (id: string, name: string) =>
  request<{ data: Specialty }>('PUT', `/specialties/${id}`, { name }).then(r => r.data)

export const deleteSpecialty = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/specialties/${id}`)

// File categories dictionary
export const getCategories = () =>
  request<{ data: FileCategory[] }>('GET', '/file-categories')

export const createCategory = (name: string) =>
  request<{ data: FileCategory }>('POST', '/file-categories', { name }).then(r => r.data)

export const updateCategory = (id: string, name: string) =>
  request<{ data: FileCategory }>('PUT', `/file-categories/${id}`, { name }).then(r => r.data)

export const deleteCategory = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/file-categories/${id}`)

// Clinics dictionary
export const getClinics = () =>
  request<{ data: Clinic[] }>('GET', '/clinics')

export const createClinic = (name: string, address?: string) =>
  request<{ data: Clinic }>('POST', '/clinics', { name, address: address || null }).then(r => r.data)

export const updateClinic = (id: string, name: string, address?: string) =>
  request<{ data: Clinic }>('PUT', `/clinics/${id}`, { name, address: address || null }).then(r => r.data)

export const deleteClinic = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/clinics/${id}`)

// Users (admin only)
export const getUsers = () =>
  request<{ data: User[] }>('GET', '/users')

export interface UserSummary {
  id: string
  name: string
}

export const getUsersOthers = () =>
  request<{ data: UserSummary[] }>('GET', '/users/others').then(r => r.data)

export const getUser = (id: string) =>
  request<{ data: User }>('GET', `/users/${id}`).then(r => r.data)

export const createUser = (body: { email: string; password: string; name: string; role: 'ADMIN' | 'USER' }) =>
  request<{ data: User }>('POST', '/users', body).then(r => r.data)

export const updateUser = (id: string, body: Partial<{ email: string; name: string; role: string; theme: string }>) =>
  request<{ data: User }>('PUT', `/users/${id}`, body).then(r => r.data)

export const updateUserPassword = (id: string, password: string) =>
  request<{ ok: boolean }>('PUT', `/users/${id}/password`, { password })

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: boolean }>('PUT', '/users/me/password', { currentPassword, newPassword })

export const updateTheme = (theme: 'LIGHT' | 'DARK' | 'SYSTEM') =>
  request<{ data: User }>('PATCH', '/users/me/theme', { theme }).then(r => r.data)

export const deleteUser = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/users/${id}`)

// Admin endpoints
export const getAdminStats = () =>
  request<{ data: AdminStats }>('GET', '/admin/stats').then(r => r.data)

export const getAdminConsultations = (page = 1, limit = 20) =>
  request<PagedResponse<Consultation>>('GET', `/admin/consultations?page=${page}&limit=${limit}`)

export const bulkDeleteConsultations = (ids: string[]) =>
  request<{ ok: boolean }>('POST', '/admin/consultations/bulk-delete', { ids })

export const getAdminProfessionals = (page = 1, limit = 20) =>
  request<PagedResponse<Professional>>('GET', `/admin/professionals?page=${page}&limit=${limit}`)

export const bulkDeleteProfessionals = (ids: string[]) =>
  request<{ ok: boolean }>('POST', '/admin/professionals/bulk-delete', { ids })

export const getAdminFiles = (page = 1, limit = 20) =>
  request<PagedResponse<MedFile>>('GET', `/admin/files?page=${page}&limit=${limit}`)

export const getAdminUserConsultations = (userId: string) =>
  request<{ data: Consultation[] }>('GET', `/admin/users/${userId}/consultations`).then(r => r.data)

export const getAdminUserProfessionals = (userId: string) =>
  request<{ data: Professional[] }>('GET', `/admin/users/${userId}/professionals`).then(r => r.data)

export interface LoginLog {
  id: string
  userId: string
  userName: string
  userEmail: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

export const getAdminLoginLogs = (page = 1, limit = 20) =>
  request<PagedResponse<LoginLog>>('GET', `/admin/login-logs?page=${page}&limit=${limit}`)

// Phones
export interface Phone {
  id: string
  number: string
  label?: string
  professionalId?: string
  clinicId?: string
  createdAt: string
}

export const getProfessionalPhones = (professionalId: string) =>
  request<{ data: Phone[] }>('GET', `/professionals/${professionalId}/phones`).then(r => r.data)

export const createProfessionalPhone = (professionalId: string, number: string, label?: string) =>
  request<{ data: Phone }>('POST', `/professionals/${professionalId}/phones`, { number, label }).then(r => r.data)

export const getClinicPhones = (clinicId: string) =>
  request<{ data: Phone[] }>('GET', `/clinics/${clinicId}/phones`).then(r => r.data)

export const createClinicPhone = (clinicId: string, number: string, label?: string) =>
  request<{ data: Phone }>('POST', `/clinics/${clinicId}/phones`, { number, label }).then(r => r.data)

export const updatePhone = (id: string, number: string, label?: string) =>
  request<{ data: Phone }>('PUT', `/phones/${id}`, { number, label }).then(r => r.data)

export const deletePhone = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/phones/${id}`)

// Sharing
export interface Sharing {
  id: string
  sharingFromUserId: string
  sharingToUserId: string
  createdAt: string
}

export const getProfessionalSharing = () =>
  request<{ data: Sharing[] }>('GET', '/sharing/professionals').then(r => r.data)

export const createProfessionalSharing = (toUserId: string) =>
  request<{ data: Sharing }>('POST', '/sharing/professionals', { toUserId }).then(r => r.data)

export const deleteProfessionalSharing = (userId: string) =>
  request<{ ok: boolean }>('DELETE', `/sharing/professionals/${userId}`)

export const getClinicSharing = () =>
  request<{ data: Sharing[] }>('GET', '/sharing/clinics').then(r => r.data)

export const createClinicSharing = (toUserId: string) =>
  request<{ data: Sharing }>('POST', '/sharing/clinics', { toUserId }).then(r => r.data)

export const deleteClinicSharing = (userId: string) =>
  request<{ ok: boolean }>('DELETE', `/sharing/clinics/${userId}`)

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
