<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { User, Consultation, Professional, MedFile, Specialty, FileCategory, Clinic, AdminStats, LoginLog } from '../lib/api'
  import FileUpload from '../components/FileUpload.svelte'
  import FileEditModal from '../components/FileEditModal.svelte'
  import { localDate } from '../lib/date'

  type Tab = 'users' | 'consultations' | 'professionals' | 'specialties' | 'categories' | 'clinics' | 'files' | 'logs' | 'gemini' | 'backup'

  interface AdminSection { key: Tab; label: string; icon: string; description: string }
  const sections: AdminSection[] = [
    { key: 'users', label: 'Usuários', icon: '👤', description: 'Gerenciar usuários do sistema' },
    { key: 'consultations', label: 'Consultas', icon: '📋', description: 'Visualizar e excluir consultas' },
    { key: 'professionals', label: 'Profissionais', icon: '🩺', description: 'Visualizar e excluir profissionais' },
    { key: 'specialties', label: 'Especialidades', icon: '🏷️', description: 'Dicionário de especialidades' },
    { key: 'categories', label: 'Categorias', icon: '📁', description: 'Categorias de arquivos' },
    { key: 'clinics', label: 'Clínicas', icon: '🏥', description: 'Clínicas e hospitais' },
    { key: 'files', label: 'Arquivos', icon: '📄', description: 'Arquivos enviados' },
    { key: 'logs', label: 'Logs', icon: '📜', description: 'Registros de login' },
    { key: 'gemini', label: 'Extração por IA', icon: '🧠', description: 'Modelo usado na leitura dos laudos' },
    { key: 'backup', label: 'Backup', icon: '💾', description: 'Backup e restauração' },
  ]

  let activeTab = $state<Tab>('users')
  let stats = $state<AdminStats | null>(null)

  // Users tab
  let users = $state<User[]>([])
  let newUserEmail = $state('')
  let newUserName = $state('')
  let newUserPassword = $state('')
  let newUserRole = $state<'ADMIN' | 'USER'>('USER')
  let userSaving = $state(false)
  let userError = $state('')
  let editingUser = $state<User | null>(null)
  let editUserName = $state('')
  let editUserRole = $state<'ADMIN' | 'USER'>('USER')
  let editUserPassword = $state('')

  // Consultations tab
  let adminConsultations = $state<Consultation[]>([])
  let selectedConsultationIds = $state<string[]>([])
  let bulkConError = $state('')
  let conPage = $state(1)
  let conTotal = $state(0)

  // Professionals tab
  let adminProfessionals = $state<Professional[]>([])
  let selectedProfessionalIds = $state<string[]>([])
  let bulkProError = $state('')
  let proPage = $state(1)
  let proTotal = $state(0)

  // Specialties tab
  let specsData = $state<Specialty[]>([])
  let newSpecName = $state('')
  let editingSpec = $state<Specialty | null>(null)
  let editSpecName = $state('')
  let specError = $state('')

  // Categories tab
  let catsData = $state<FileCategory[]>([])
  let newCatName = $state('')
  let editingCat = $state<FileCategory | null>(null)
  let editCatName = $state('')
  let catError = $state('')

  // Clinics tab
  let clinicsData = $state<Clinic[]>([])
  let newClinicName = $state('')
  let newClinicAddress = $state('')
  let editingClinic = $state<Clinic | null>(null)
  let editClinicName = $state('')
  let editClinicAddress = $state('')
  let clinicError = $state('')

  // Files tab
  let filesData = $state<MedFile[]>([])
  let filePage = $state(1)
  let fileTotal = $state(0)
  const adminLimit = 20
  let fileEditing = $state<MedFile | null>(null)
  let showAdminUpload = $state(false)

  // Login logs tab
  let logsData = $state<LoginLog[]>([])
  let logPage = $state(1)
  let logTotal = $state(0)

  // Backup/Restore
  let restoreFile = $state<File | null>(null)
  let restoring = $state(false)
  let restoreMsg = $state('')
  let restoreError = $state('')
  let downloadingBackup = $state(false)

  // Extração por IA
  let geminiConfig = $state<api.GeminiModelConfig | null>(null)
  let geminiSaving = $state(false)
  let geminiMsg = $state('')
  let geminiError = $state('')

  onMount(async () => {
    await loadAll()
    await loadGeminiConfig()
  })

  async function loadAll() {
    const [statsRes, usersRes, consRes, prosRes, specsRes, catsRes, clinicsRes, filesRes, logsRes] = await Promise.allSettled([
      api.getAdminStats(),
      api.getUsers(),
      api.getAdminConsultations(conPage, adminLimit),
      api.getAdminProfessionals(proPage, adminLimit),
      api.getSpecialties(),
      api.getCategories(),
      api.getClinics(),
      api.getAdminFiles(filePage, adminLimit),
      api.getAdminLoginLogs(logPage, adminLimit),
    ])

    if (statsRes.status === 'fulfilled') stats = statsRes.value
    if (usersRes.status === 'fulfilled') users = usersRes.value.data
    if (consRes.status === 'fulfilled') { adminConsultations = consRes.value.data; conTotal = consRes.value.total }
    if (prosRes.status === 'fulfilled') { adminProfessionals = prosRes.value.data; proTotal = prosRes.value.total }
    if (specsRes.status === 'fulfilled') specsData = specsRes.value.data
    if (catsRes.status === 'fulfilled') catsData = catsRes.value.data
    if (clinicsRes.status === 'fulfilled') clinicsData = clinicsRes.value.data
    if (filesRes.status === 'fulfilled') { filesData = filesRes.value.data; fileTotal = filesRes.value.total }
    if (logsRes.status === 'fulfilled') { logsData = logsRes.value.data; logTotal = logsRes.value.total }
  }

  async function loadConsultations(p: number) {
    conPage = p; selectedConsultationIds = []
    const res = await api.getAdminConsultations(p, adminLimit)
    adminConsultations = res.data; conTotal = res.total
  }

  async function loadProfessionals(p: number) {
    proPage = p; selectedProfessionalIds = []
    const res = await api.getAdminProfessionals(p, adminLimit)
    adminProfessionals = res.data; proTotal = res.total
  }

  async function loadFiles(p: number) {
    filePage = p
    const res = await api.getAdminFiles(p, adminLimit)
    filesData = res.data; fileTotal = res.total
  }

  async function loadLogs(p: number) {
    logPage = p
    const res = await api.getAdminLoginLogs(p, adminLimit)
    logsData = res.data; logTotal = res.total
  }

  // Users
  async function createUser(e: Event) {
    e.preventDefault()
    userSaving = true
    userError = ''
    try {
      const u = await api.createUser({ email: newUserEmail, name: newUserName, password: newUserPassword, role: newUserRole })
      users = [...users, u]
      newUserEmail = newUserName = newUserPassword = ''
      newUserRole = 'USER'
    } catch (err: unknown) {
      userError = err instanceof Error ? err.message : 'Erro ao criar usuário'
    } finally {
      userSaving = false
    }
  }

  function startEditUser(u: User) {
    editingUser = u
    editUserName = u.name
    editUserRole = u.role
    editUserPassword = ''
  }

  async function saveEditUser() {
    if (!editingUser) return
    userSaving = true
    userError = ''
    try {
      const body: Record<string, string> = { name: editUserName, role: editUserRole }
      if (editUserPassword) body.password = editUserPassword
      const updated = await api.updateUser(editingUser.id, body)
      users = users.map(u => u.id === updated.id ? updated : u)
      editingUser = null
    } catch (err: unknown) {
      userError = err instanceof Error ? err.message : 'Erro ao salvar usuário'
    } finally {
      userSaving = false
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Excluir usuário?')) return
    try {
      await api.deleteUser(id)
      users = users.filter(u => u.id !== id)
    } catch (err: unknown) {
      userError = err instanceof Error ? err.message : 'Erro ao excluir'
    }
  }

  // Consultations bulk delete
  function toggleConsultation(id: string) {
    if (selectedConsultationIds.includes(id)) {
      selectedConsultationIds = selectedConsultationIds.filter(x => x !== id)
    } else {
      selectedConsultationIds = [...selectedConsultationIds, id]
    }
  }

  function toggleAllConsultations() {
    if (selectedConsultationIds.length === adminConsultations.length) {
      selectedConsultationIds = []
    } else {
      selectedConsultationIds = adminConsultations.map(c => c.id)
    }
  }

  async function bulkDeleteConsultations() {
    if (selectedConsultationIds.length === 0) return
    if (!confirm(`Excluir ${selectedConsultationIds.length} consulta(s)?`)) return
    bulkConError = ''
    try {
      await api.bulkDeleteConsultations(selectedConsultationIds)
      adminConsultations = adminConsultations.filter(c => !selectedConsultationIds.includes(c.id))
      selectedConsultationIds = []
      if (stats) stats = { ...stats, consultations: adminConsultations.length }
    } catch (err: unknown) {
      bulkConError = err instanceof Error ? err.message : 'Erro ao excluir'
    }
  }

  // Professionals bulk delete
  function toggleProfessional(id: string) {
    if (selectedProfessionalIds.includes(id)) {
      selectedProfessionalIds = selectedProfessionalIds.filter(x => x !== id)
    } else {
      selectedProfessionalIds = [...selectedProfessionalIds, id]
    }
  }

  function toggleAllProfessionals() {
    if (selectedProfessionalIds.length === adminProfessionals.length) {
      selectedProfessionalIds = []
    } else {
      selectedProfessionalIds = adminProfessionals.map(p => p.id)
    }
  }

  async function bulkDeleteProfessionals() {
    if (selectedProfessionalIds.length === 0) return
    if (!confirm(`Excluir ${selectedProfessionalIds.length} profissional(ais)?`)) return
    bulkProError = ''
    try {
      await api.bulkDeleteProfessionals(selectedProfessionalIds)
      adminProfessionals = adminProfessionals.filter(p => !selectedProfessionalIds.includes(p.id))
      selectedProfessionalIds = []
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 409) {
        bulkProError = 'Alguns profissionais possuem consultas e não podem ser excluídos.'
      } else {
        bulkProError = e.message || 'Erro ao excluir'
      }
    }
  }

  // Specialties CRUD
  async function createSpec(e: Event) {
    e.preventDefault()
    specError = ''
    try {
      const s = await api.createSpecialty(newSpecName)
      specsData = [...specsData, s]
      newSpecName = ''
    } catch (err: unknown) {
      specError = err instanceof Error ? err.message : 'Erro ao criar'
    }
  }

  async function saveSpec() {
    if (!editingSpec) return
    specError = ''
    try {
      const s = await api.updateSpecialty(editingSpec.id, editSpecName)
      specsData = specsData.map(x => x.id === s.id ? s : x)
      editingSpec = null
    } catch (err: unknown) {
      specError = err instanceof Error ? err.message : 'Erro ao salvar'
    }
  }

  async function deleteSpec(id: string) {
    if (!confirm('Excluir especialidade?')) return
    specError = ''
    try {
      await api.deleteSpecialty(id)
      specsData = specsData.filter(s => s.id !== id)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      specError = e.status === 409 ? 'Especialidade em uso — não pode ser excluída.' : (e.message || 'Erro ao excluir')
    }
  }

  // Categories CRUD
  async function createCat(e: Event) {
    e.preventDefault()
    catError = ''
    try {
      const c = await api.createCategory(newCatName)
      catsData = [...catsData, c]
      newCatName = ''
    } catch (err: unknown) {
      catError = err instanceof Error ? err.message : 'Erro ao criar'
    }
  }

  async function saveCat() {
    if (!editingCat) return
    catError = ''
    try {
      const c = await api.updateCategory(editingCat.id, editCatName)
      catsData = catsData.map(x => x.id === c.id ? c : x)
      editingCat = null
    } catch (err: unknown) {
      catError = err instanceof Error ? err.message : 'Erro ao salvar'
    }
  }

  async function deleteCat(id: string) {
    if (!confirm('Excluir categoria?')) return
    catError = ''
    try {
      await api.deleteCategory(id)
      catsData = catsData.filter(c => c.id !== id)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      catError = e.status === 409 ? 'Categoria em uso — não pode ser excluída.' : (e.message || 'Erro ao excluir')
    }
  }

  // Clinics CRUD
  async function createClinicItem(e: Event) {
    e.preventDefault()
    clinicError = ''
    try {
      const c = await api.createClinic(newClinicName, newClinicAddress)
      clinicsData = [...clinicsData, c]
      newClinicName = ''
      newClinicAddress = ''
    } catch (err: unknown) {
      clinicError = err instanceof Error ? err.message : 'Erro ao criar'
    }
  }

  async function saveClinic() {
    if (!editingClinic) return
    clinicError = ''
    try {
      const c = await api.updateClinic(editingClinic.id, editClinicName, editClinicAddress)
      clinicsData = clinicsData.map(x => x.id === c.id ? c : x)
      editingClinic = null
    } catch (err: unknown) {
      clinicError = err instanceof Error ? err.message : 'Erro ao salvar'
    }
  }

  async function deleteClinicItem(id: string) {
    if (!confirm('Excluir clínica?')) return
    clinicError = ''
    try {
      await api.deleteClinic(id)
      clinicsData = clinicsData.filter(c => c.id !== id)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      clinicError = e.status === 409 ? 'Clínica em uso — não pode ser excluída.' : (e.message || 'Erro ao excluir')
    }
  }

  // Backup
  async function handleDownloadBackup() {
    downloadingBackup = true
    try {
      const res = await api.downloadBackup()
      if (!res.ok) throw new Error('Falha ao baixar backup')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `medlog-backup-${new Date().toISOString().split('T')[0]}.sqlite`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      restoreError = err instanceof Error ? err.message : 'Erro ao baixar backup'
    } finally {
      downloadingBackup = false
    }
  }

  function onRestoreFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    restoreFile = input.files?.[0] ?? null
  }

  async function handleRestore() {
    if (!restoreFile) return
    if (!confirm('Restaurar backup? Todos os dados atuais serão substituídos.')) return
    restoring = true
    restoreMsg = ''
    restoreError = ''
    try {
      await api.restoreBackup(restoreFile)
      restoreMsg = 'Restauração concluída. Faça login novamente.'
    } catch (err: unknown) {
      restoreError = err instanceof Error ? err.message : 'Erro ao restaurar'
    } finally {
      restoring = false
    }
  }

  function formatDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR')
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function onAdminFileUploaded(f: MedFile) {
    showAdminUpload = false
    loadFiles(1)
  }

  function onAdminEditSaved(updated: MedFile) {
    filesData = filesData.map(f => (f.id === updated.id ? updated : f))
    fileEditing = null
  }

  async function deleteAdminFile(f: MedFile) {
    const name = f.customName || f.filename
    const prompt = f.consultationId
      ? `"${name}" está vinculado a uma consulta e não pode ser excluído — deseja apenas desvincular?`
      : `Excluir "${name}"?`
    if (!confirm(prompt)) return
    try {
      await api.deleteFile(f.id)
      loadFiles(filePage)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir arquivo.')
    }
  }

  function fileMimeLabel(mime: string): string {
    if (mime === 'application/pdf') return 'PDF'
    if (mime === 'image/png') return 'PNG'
    if (mime === 'image/jpeg') return 'JPG'
    return mime
  }

  async function loadGeminiConfig() {
    geminiError = ''
    try {
      geminiConfig = await api.getGeminiModel()
    } catch (e: unknown) {
      geminiError = e instanceof Error ? e.message : 'Erro ao carregar a configuração de extração'
    }
  }

  async function selectGeminiModel(model: string) {
    if (!geminiConfig || geminiSaving || geminiConfig.current === model) return
    geminiSaving = true
    geminiMsg = ''
    geminiError = ''
    try {
      const res = await api.setGeminiModel(model)
      const label = geminiConfig.available.find(m => m.model === res.current)?.label ?? res.current
      geminiConfig = { ...geminiConfig, current: res.current }
      geminiMsg = `Modelo alterado para ${label}. Vale para as próximas extrações.`
    } catch (e: unknown) {
      geminiError = e instanceof Error ? e.message : 'Erro ao alterar o modelo'
    } finally {
      geminiSaving = false
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Administração</h1>
  </div>

  {#if stats}
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-num">{stats.users}</div>
        <div class="stat-label">Usuários</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{stats.consultations}</div>
        <div class="stat-label">Consultas</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{stats.professionals}</div>
        <div class="stat-label">Profissionais</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{stats.files}</div>
        <div class="stat-label">Arquivos</div>
      </div>
    </div>
  {/if}

  <div class="admin-nav-grid">
    {#each sections as s}
      <button
        class="nav-card"
        class:active={activeTab === s.key}
        onclick={() => (activeTab = s.key)}
        title={s.description}
      >
        <span class="nav-card-icon">{s.icon}</span>
        <span class="nav-card-label">{s.label}</span>
      </button>
    {/each}
  </div>

  <div class="tab-content">

    <!-- Users Tab -->
    {#if activeTab === 'users'}
      <div class="tab-section">
        <h3>Criar Usuário</h3>
        <form class="inline-form-row" onsubmit={createUser}>
          <input type="email" bind:value={newUserEmail} placeholder="E-mail" required disabled={userSaving} />
          <input type="text" bind:value={newUserName} placeholder="Nome" required disabled={userSaving} />
          <input type="password" bind:value={newUserPassword} placeholder="Senha" required disabled={userSaving} />
          <select bind:value={newUserRole} disabled={userSaving}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button type="submit" class="btn btn-primary" disabled={userSaving}>Criar</button>
        </form>
        {#if userError}
          <p class="error-msg" style="margin-bottom:12px">{userError}</p>
        {/if}

        {#if editingUser}
          <div class="card" style="margin-bottom:16px">
            <h4 style="margin-bottom:12px">Editar: {editingUser.email}</h4>
            <div class="inline-form-row">
              <input type="text" bind:value={editUserName} placeholder="Nome" />
              <input type="password" bind:value={editUserPassword} placeholder="Nova senha (opcional)" />
              <select bind:value={editUserRole}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button class="btn btn-primary" onclick={saveEditUser} disabled={userSaving}>Salvar</button>
              <button class="btn btn-ghost" onclick={() => (editingUser = null)}>Cancelar</button>
            </div>
          </div>
        {/if}

        <table>
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr>
          </thead>
          <tbody>
            {#each users as u (u.id)}
              <tr>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span class="badge {u.role === 'ADMIN' ? 'badge-yellow' : 'badge-blue'}">{u.role}</span></td>
                <td class="actions-cell">
                  <button class="btn btn-ghost btn-xs" onclick={() => startEditUser(u)}>Editar</button>
                  <button class="btn btn-danger btn-xs" onclick={() => deleteUser(u.id)}>Excluir</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Consultations Tab -->
    {:else if activeTab === 'consultations'}
      <div class="tab-section">
        {#if bulkConError}
          <p class="error-msg" style="margin-bottom:12px">{bulkConError}</p>
        {/if}
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button
            class="btn btn-danger"
            onclick={bulkDeleteConsultations}
            disabled={selectedConsultationIds.length === 0}
          >
            Excluir selecionados ({selectedConsultationIds.length})
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onchange={toggleAllConsultations} checked={selectedConsultationIds.length === adminConsultations.length && adminConsultations.length > 0} /></th>
              <th>Data</th><th>Tipo</th><th>Profissional</th><th>Propósito</th>
            </tr>
          </thead>
          <tbody>
            {#each adminConsultations as c (c.id)}
              <tr>
                <td><input type="checkbox" checked={selectedConsultationIds.includes(c.id)} onchange={() => toggleConsultation(c.id)} /></td>
                <td>{formatDate(c.date)}</td>
                <td><span class="badge {c.type === 'CONSULTATION' ? 'badge-blue' : 'badge-yellow'}">{c.type === 'CONSULTATION' ? 'Consulta' : 'Evento'}</span></td>
                <td>{c.professional?.name ?? '—'}</td>
                <td class="truncate">{c.proposito ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if Math.ceil(conTotal / adminLimit) > 1}
          <div class="pagination">
            <button class="btn btn-ghost" disabled={conPage <= 1} onclick={() => loadConsultations(conPage - 1)}>‹ Anterior</button>
            <span class="page-info">Página {conPage} de {Math.ceil(conTotal / adminLimit)} · {conTotal} total</span>
            <button class="btn btn-ghost" disabled={conPage >= Math.ceil(conTotal / adminLimit)} onclick={() => loadConsultations(conPage + 1)}>Próxima ›</button>
          </div>
        {/if}
      </div>

    <!-- Professionals Tab -->
    {:else if activeTab === 'professionals'}
      <div class="tab-section">
        {#if bulkProError}
          <p class="error-msg" style="margin-bottom:12px">{bulkProError}</p>
        {/if}
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button
            class="btn btn-danger"
            onclick={bulkDeleteProfessionals}
            disabled={selectedProfessionalIds.length === 0}
          >
            Excluir selecionados ({selectedProfessionalIds.length})
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onchange={toggleAllProfessionals} checked={selectedProfessionalIds.length === adminProfessionals.length && adminProfessionals.length > 0} /></th>
              <th>Nome</th><th>Especialidades</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each adminProfessionals as p (p.id)}
              <tr>
                <td><input type="checkbox" checked={selectedProfessionalIds.includes(p.id)} onchange={() => toggleProfessional(p.id)} /></td>
                <td>{p.name}</td>
                <td>{p.specialties.map(s => s.name).join(', ') || '—'}</td>
                <td><span class="badge {p.isActive ? 'badge-green' : 'badge-red'}">{p.isActive ? 'Ativo' : 'Inativo'}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if Math.ceil(proTotal / adminLimit) > 1}
          <div class="pagination">
            <button class="btn btn-ghost" disabled={proPage <= 1} onclick={() => loadProfessionals(proPage - 1)}>‹ Anterior</button>
            <span class="page-info">Página {proPage} de {Math.ceil(proTotal / adminLimit)} · {proTotal} total</span>
            <button class="btn btn-ghost" disabled={proPage >= Math.ceil(proTotal / adminLimit)} onclick={() => loadProfessionals(proPage + 1)}>Próxima ›</button>
          </div>
        {/if}
      </div>

    <!-- Specialties Tab -->
    {:else if activeTab === 'specialties'}
      <div class="tab-section">
        <form class="inline-form-row" onsubmit={createSpec}>
          <input type="text" bind:value={newSpecName} placeholder="Nova especialidade" required />
          <button type="submit" class="btn btn-primary">Adicionar</button>
        </form>
        {#if specError}
          <p class="error-msg" style="margin-bottom:12px">{specError}</p>
        {/if}
        <table>
          <thead><tr><th>Nome</th><th></th></tr></thead>
          <tbody>
            {#each specsData as s (s.id)}
              <tr>
                <td>
                  {#if editingSpec?.id === s.id}
                    <input type="text" bind:value={editSpecName} style="width:200px" />
                  {:else}
                    {s.name}
                  {/if}
                </td>
                <td class="actions-cell">
                  {#if editingSpec?.id === s.id}
                    <button class="btn btn-primary btn-xs" onclick={saveSpec}>Salvar</button>
                    <button class="btn btn-ghost btn-xs" onclick={() => (editingSpec = null)}>Cancelar</button>
                  {:else}
                    <button class="btn btn-ghost btn-xs" onclick={() => { editingSpec = s; editSpecName = s.name }}>Editar</button>
                    <button class="btn btn-danger btn-xs" onclick={() => deleteSpec(s.id)}>Excluir</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Categories Tab -->
    {:else if activeTab === 'categories'}
      <div class="tab-section">
        <form class="inline-form-row" onsubmit={createCat}>
          <input type="text" bind:value={newCatName} placeholder="Nova categoria" required />
          <button type="submit" class="btn btn-primary">Adicionar</button>
        </form>
        {#if catError}
          <p class="error-msg" style="margin-bottom:12px">{catError}</p>
        {/if}
        <table>
          <thead><tr><th>Nome</th><th></th></tr></thead>
          <tbody>
            {#each catsData as c (c.id)}
              <tr>
                <td>
                  {#if editingCat?.id === c.id}
                    <input type="text" bind:value={editCatName} style="width:200px" />
                  {:else}
                    {c.name}
                  {/if}
                </td>
                <td class="actions-cell">
                  {#if editingCat?.id === c.id}
                    <button class="btn btn-primary btn-xs" onclick={saveCat}>Salvar</button>
                    <button class="btn btn-ghost btn-xs" onclick={() => (editingCat = null)}>Cancelar</button>
                  {:else}
                    <button class="btn btn-ghost btn-xs" onclick={() => { editingCat = c; editCatName = c.name }}>Editar</button>
                    <button class="btn btn-danger btn-xs" onclick={() => deleteCat(c.id)}>Excluir</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Clinics Tab -->
    {:else if activeTab === 'clinics'}
      <div class="tab-section">
        <form class="inline-form-row" onsubmit={createClinicItem}>
          <input type="text" bind:value={newClinicName} placeholder="Nome da clínica/hospital" required />
          <input type="text" bind:value={newClinicAddress} placeholder="Endereço (opcional)" />
          <button type="submit" class="btn btn-primary">Adicionar</button>
        </form>
        {#if clinicError}
          <p class="error-msg" style="margin-bottom:12px">{clinicError}</p>
        {/if}
        <table>
          <thead><tr><th>Nome</th><th>Endereço</th><th></th></tr></thead>
          <tbody>
            {#each clinicsData as c (c.id)}
              <tr>
                <td>
                  {#if editingClinic?.id === c.id}
                    <input type="text" bind:value={editClinicName} style="width:200px" />
                  {:else}
                    {c.name}
                  {/if}
                </td>
                <td>
                  {#if editingClinic?.id === c.id}
                    <input type="text" bind:value={editClinicAddress} placeholder="Endereço (opcional)" style="width:250px" />
                  {:else}
                    {c.address || '—'}
                  {/if}
                </td>
                <td class="actions-cell">
                  {#if editingClinic?.id === c.id}
                    <button class="btn btn-primary btn-xs" onclick={saveClinic}>Salvar</button>
                    <button class="btn btn-ghost btn-xs" onclick={() => (editingClinic = null)}>Cancelar</button>
                  {:else}
                    <button class="btn btn-ghost btn-xs" onclick={() => { editingClinic = c; editClinicName = c.name; editClinicAddress = c.address ?? '' }}>Editar</button>
                    <button class="btn btn-danger btn-xs" onclick={() => deleteClinicItem(c.id)}>Excluir</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Files Tab -->
    {:else if activeTab === 'files'}
      <div class="tab-section">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary" onclick={() => (showAdminUpload = !showAdminUpload)}>
            {showAdminUpload ? 'Cancelar' : 'Adicionar Arquivo'}
          </button>
        </div>

        {#if showAdminUpload}
          <div style="margin-bottom:16px">
            <FileUpload
              showConsultationPicker={true}
              showOwnerPicker={true}
              onUploaded={onAdminFileUploaded}
            />
          </div>
        {/if}

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Categorias</th>
              <th>Data</th>
              <th>Profissional</th>
              <th>Tamanho</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each filesData as f (f.id)}
              <tr>
                <td>
                  <a href="/api/files/{f.filename}" target="_blank" rel="noopener">
                    {f.customName || f.filename}
                  </a>
                </td>
                <td><span class="badge badge-blue">{fileMimeLabel(f.mimeType)}</span></td>
                <td>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    {#each f.categories as cat}
                      <span class="badge badge-gray">{cat.name}</span>
                    {/each}
                    {#if f.categories.length === 0}
                      <span style="color:var(--text-muted)">—</span>
                    {/if}
                  </div>
                </td>
                <td style="white-space:nowrap">{f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td>{f.professionalName ?? '—'}</td>
                <td style="white-space:nowrap">{formatSize(f.size)}</td>
                <td class="actions-cell">
                  <button class="icon-btn" onclick={() => (fileEditing = f)} title="Editar">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button class="icon-btn icon-btn-danger" onclick={() => deleteAdminFile(f)} title={f.consultationId ? 'Desvincular da consulta' : 'Excluir'}>
                    <i class="bx bx-trash"></i>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if Math.ceil(fileTotal / adminLimit) > 1}
          <div class="pagination">
            <button class="btn btn-ghost" disabled={filePage <= 1} onclick={() => loadFiles(filePage - 1)}>‹ Anterior</button>
            <span class="page-info">Página {filePage} de {Math.ceil(fileTotal / adminLimit)} · {fileTotal} total</span>
            <button class="btn btn-ghost" disabled={filePage >= Math.ceil(fileTotal / adminLimit)} onclick={() => loadFiles(filePage + 1)}>Próxima ›</button>
          </div>
        {/if}
      </div>

    <!-- Login Logs Tab -->
    {:else if activeTab === 'logs'}
      <div class="tab-section">
        <table>
          <thead>
            <tr><th>Data/Hora</th><th>Usuário</th><th>E-mail</th><th>IP</th><th>User Agent</th></tr>
          </thead>
          <tbody>
            {#each logsData as l (l.id)}
              <tr>
                <td style="white-space:nowrap">{new Date(l.timestamp).toLocaleString('pt-BR')}</td>
                <td>{l.userName}</td>
                <td>{l.userEmail}</td>
                <td>{l.ipAddress ?? '—'}</td>
                <td class="truncate" title={l.userAgent ?? ''}>{l.userAgent ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if Math.ceil(logTotal / adminLimit) > 1}
          <div class="pagination">
            <button class="btn btn-ghost" disabled={logPage <= 1} onclick={() => loadLogs(logPage - 1)}>‹ Anterior</button>
            <span class="page-info">Página {logPage} de {Math.ceil(logTotal / adminLimit)} · {logTotal} total</span>
            <button class="btn btn-ghost" disabled={logPage >= Math.ceil(logTotal / adminLimit)} onclick={() => loadLogs(logPage + 1)}>Próxima ›</button>
          </div>
        {/if}
      </div>

    <!-- Backup Tab -->
    {:else if activeTab === 'backup'}
    <div class="backup-row">
      <div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
          Baixe um arquivo de backup do banco de dados SQLite.
        </p>
        <button class="btn btn-secondary" onclick={handleDownloadBackup} disabled={downloadingBackup}>
          {downloadingBackup ? 'Baixando...' : 'Download Backup'}
        </button>
      </div>
      <div class="restore-box">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
          Restaurar banco a partir de arquivo .sqlite — substituirá todos os dados.
        </p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input type="file" accept=".sqlite,.db" onchange={onRestoreFileChange} style="font-size:13px" />
          <button
            class="btn btn-danger"
            onclick={handleRestore}
            disabled={!restoreFile || restoring}
          >
            {restoring ? 'Restaurando...' : 'Restaurar'}
          </button>
        </div>
        {#if restoreMsg}
          <p class="success-msg" style="margin-top:10px">{restoreMsg}</p>
        {/if}
        {#if restoreError}
          <p class="error-msg" style="margin-top:10px">{restoreError}</p>
        {/if}
      </div>
    </div>
    <!-- Extração por IA Tab -->
    {:else if activeTab === 'gemini'}
      <div class="tab-section">
        {#if geminiConfig && !geminiConfig.apiKeySet}
          <div class="key-warning">
            <strong>GEMINI_API_KEY não está configurada neste servidor.</strong>
            <p>
              Enquanto a variável de ambiente estiver ausente, <strong>nenhuma extração vai
              funcionar</strong>: o disparo falha antes de qualquer documento ser enviado.
            </p>
            <p>
              A chave é lida do ambiente do container e, por decisão de segurança,
              <strong>não é configurável por esta interface</strong>. Defina
              <code>GEMINI_API_KEY</code> no ambiente do serviço e reinicie.
            </p>
          </div>
        {/if}

        <h3>Modelo usado na leitura dos laudos</h3>

        {#if geminiError}
          <p class="error-msg">{geminiError}</p>
        {/if}

        {#if !geminiConfig}
          <p class="loading">Carregando...</p>
        {:else}
          <div class="model-list">
            {#each geminiConfig.available as m (m.model)}
              <label class="model-option" class:selected={geminiConfig.current === m.model}>
                <input
                  type="radio"
                  name="gemini-model"
                  value={m.model}
                  checked={geminiConfig.current === m.model}
                  disabled={geminiSaving}
                  onchange={() => selectGeminiModel(m.model)}
                />
                <span class="model-text">
                  <span class="model-label">{m.label}</span>
                  <span class="model-id">{m.model}</span>
                </span>
                <span class="model-cost">
                  US$ {m.costPerReportUsd}<span class="model-cost-unit"> / laudo</span>
                </span>
              </label>
            {/each}
          </div>

          {#if geminiMsg}
            <p class="success-msg">{geminiMsg}</p>
          {/if}

          <p class="model-note">
            Use uma chave do <strong>tier pago</strong>. No tier gratuito o Google usa o
            conteúdo enviado para treinar seus modelos — o laudo inteiro, com nome e data de
            nascimento, entraria no treinamento.
          </p>
        {/if}
      </div>

    {/if}

  </div>
</div>

{#if fileEditing}
  <FileEditModal
    file={fileEditing}
    onSaved={onAdminEditSaved}
    onClose={() => (fileEditing = null)}
  />
{/if}

<style>
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }

  .stat-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    text-align: center;
  }

  .stat-num {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .admin-nav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
    margin-bottom: 24px;
  }

  .nav-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 18px 12px;
    background: var(--bg-surface);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
    font-family: inherit;
    font-size: inherit;
    color: var(--text-muted);
  }

  .nav-card:hover {
    border-color: var(--accent);
    color: var(--text);
    transform: translateY(-1px);
  }

  .nav-card.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-surface));
    color: var(--accent);
    font-weight: 600;
  }

  .nav-card-icon {
    font-size: 26px;
    line-height: 1;
  }

  .nav-card-label {
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }

  .tab-content {
    min-height: 300px;
    margin-bottom: 32px;
  }

  .tab-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tab-section h3 {
    font-size: 15px;
    font-weight: 600;
  }

  .inline-form-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
  }

  .inline-form-row input,
  .inline-form-row select {
    flex: 1;
    min-width: 140px;
  }

  .actions-cell {
    display: flex;
    gap: 6px;
    white-space: nowrap;
  }

  .btn-xs {
    padding: 3px 10px;
    font-size: 12px;
  }

  .truncate {
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .backup-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .restore-box {
    border-left: 1px solid var(--border);
    padding-left: 24px;
  }

  @media (max-width: 600px) {
    .backup-row {
      grid-template-columns: 1fr;
    }
    .restore-box {
      border-left: none;
      border-top: 1px solid var(--border);
      padding-left: 0;
      padding-top: 16px;
    }
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }

  .page-info {
    font-size: 13px;
    color: var(--text-muted);
  }

  .key-warning {
    border: 1px solid var(--danger);
    border-left-width: 3px;
    border-radius: var(--radius);
    padding: 14px 16px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .key-warning strong {
    color: var(--danger);
  }

  .key-warning p {
    margin: 8px 0 0;
  }

  .key-warning code {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    background: var(--bg-elevated);
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--text);
  }

  .model-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 620px;
  }

  .model-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .model-option:hover {
    border-color: var(--accent);
  }

  .model-option.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-surface));
  }

  .model-option input {
    width: 16px;
    height: 16px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--accent);
  }

  .model-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .model-label {
    font-size: 13px;
    font-weight: 600;
  }

  .model-id {
    font-size: 11px;
    color: var(--text-muted);
    font-family: ui-monospace, monospace;
  }

  .model-cost {
    margin-left: auto;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .model-cost-unit {
    font-weight: 400;
    font-size: 12px;
    color: var(--text-muted);
  }

  .model-note {
    max-width: 620px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .model-note strong {
    color: var(--text);
  }
</style>
