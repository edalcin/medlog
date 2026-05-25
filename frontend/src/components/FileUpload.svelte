<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { FileCategory, MedFile, Consultation, Professional, User } from '../lib/api'

  let {
    consultationId,
    professionalId,
    showConsultationPicker = false,
    showOwnerPicker = false,
    onUploaded,
  } = $props<{
    consultationId?: string
    professionalId?: string
    showConsultationPicker?: boolean
    showOwnerPicker?: boolean
    onUploaded?: (file: MedFile) => void
  }>()

  let inputId = $state('')
  let categories = $state<FileCategory[]>([])
  let consultations = $state<Consultation[]>([])
  let professionals = $state<Professional[]>([])
  let users = $state<User[]>([])

  let selectedCategoryIds = $state<string[]>([])
  let selectedConsultationId = $state('')
  $effect(() => { selectedConsultationId = consultationId ?? '' })
  let selectedProfessionalId = $state('')
  let selectedOwnerUserId = $state('')
  let selectedFile = $state<File | null>(null)
  let customName = $state('')
  let uploading = $state(false)
  let error = $state('')
  let success = $state('')

  onMount(async () => {
    inputId = crypto.randomUUID()
    try {
      const res = await api.getCategories()
      categories = res.data
    } catch {
      // Categories are optional — silently ignore load failure
    }
    if (showConsultationPicker && !showOwnerPicker) {
      try {
        const [consultRes, profRes] = await Promise.all([
          api.getConsultations(1, 1000),
          api.getProfessionals(false, 1, 1000),
        ])
        consultations = consultRes.data
        professionals = profRes.data
      } catch {
        // ignore
      }
    }
    if (showOwnerPicker) {
      try {
        const res = await api.getUsers()
        users = res.data
      } catch {
        // ignore
      }
    }
  })

  $effect(() => {
    if (!showOwnerPicker || !showConsultationPicker) return
    const uid = selectedOwnerUserId
    consultations = []
    professionals = []
    selectedConsultationId = ''
    selectedProfessionalId = ''
    if (!uid) return
    Promise.all([
      api.getAdminUserConsultations(uid),
      api.getAdminUserProfessionals(uid),
    ]).then(([cs, ps]) => {
      consultations = cs
      professionals = ps
    }).catch(() => {})
  })

  function toggleCategory(id: string) {
    if (selectedCategoryIds.includes(id)) {
      selectedCategoryIds = selectedCategoryIds.filter(c => c !== id)
    } else {
      selectedCategoryIds = [...selectedCategoryIds, id]
    }
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    selectedFile = input.files?.[0] ?? null
    if (selectedFile && !customName) {
      customName = selectedFile.name.replace(/\.[^.]+$/, '')
    }
    error = ''
  }

  async function upload() {
    if (!selectedFile) return
    uploading = true
    error = ''
    success = ''
    try {
      const effectiveConsultationId = consultationId || selectedConsultationId || undefined
      const effectiveProfessionalId = professionalId || selectedProfessionalId || undefined
      const uploaded = await api.uploadFile(selectedFile, {
        consultationId: effectiveConsultationId,
        professionalId: effectiveProfessionalId,
        categoryIds: selectedCategoryIds,
        customName: customName || undefined,
        ownerUserId: selectedOwnerUserId || undefined,
      })
      success = `Arquivo "${selectedFile.name}" enviado com sucesso.`
      selectedFile = null
      customName = ''
      selectedCategoryIds = []
      selectedConsultationId = ''
      selectedProfessionalId = ''
      selectedOwnerUserId = ''
      const input = document.getElementById(inputId) as HTMLInputElement
      if (input) input.value = ''
      onUploaded?.(uploaded)
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string }
      if (err.status === 413) {
        error = 'Arquivo muito grande. Tamanho máximo: 10MB.'
      } else if (err.status === 415) {
        error = 'Tipo de arquivo não suportado. Apenas PDF, PNG e JPG.'
      } else {
        error = err.message || 'Erro ao enviar arquivo.'
      }
    } finally {
      uploading = false
    }
  }
</script>

<div class="file-upload">
  <h4>Adicionar Arquivo</h4>

  {#if showOwnerPicker && users.length > 0}
    <div class="form-group">
      <label for="owner-{inputId}">Proprietário</label>
      <select id="owner-{inputId}" bind:value={selectedOwnerUserId} disabled={uploading}>
        <option value="">— Selecionar usuário —</option>
        {#each users as u}
          <option value={u.id}>{u.name} ({u.email})</option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="form-group">
    <label for={inputId}>Arquivo (PDF, PNG, JPG — máx 10MB)</label>
    <input
      type="file"
      id={inputId}
      accept=".pdf,.png,.jpg,.jpeg"
      onchange={onFileChange}
      disabled={uploading}
    />
  </div>

  {#if selectedFile}
    <div class="form-group">
      <label for="name-{inputId}">Nome personalizado</label>
      <input
        type="text"
        id="name-{inputId}"
        bind:value={customName}
        placeholder="Nome do arquivo (sem extensão)"
        disabled={uploading}
      />
    </div>
  {/if}

  {#if showConsultationPicker && !consultationId}
    <div class="form-group">
      <label for="consult-{inputId}">Vincular a consulta (opcional)</label>
      <select id="consult-{inputId}" bind:value={selectedConsultationId} disabled={uploading || (showOwnerPicker && !selectedOwnerUserId)}>
        <option value="">
          {showOwnerPicker && !selectedOwnerUserId ? '— Selecione um usuário primeiro —' : '— Nenhuma consulta —'}
        </option>
        {#each consultations as c}
          <option value={c.id}>
            {new Date(c.date).toLocaleDateString('pt-BR')}
            {c.professional?.name ? ' · ' + c.professional.name : ''}
          </option>
        {/each}
      </select>
    </div>

    {#if !professionalId}
      <div class="form-group">
        <label for="prof-{inputId}">Vincular a profissional (opcional)</label>
        <select id="prof-{inputId}" bind:value={selectedProfessionalId} disabled={uploading || (showOwnerPicker && !selectedOwnerUserId)}>
          <option value="">
            {showOwnerPicker && !selectedOwnerUserId ? '— Selecione um usuário primeiro —' : '— Nenhum profissional —'}
          </option>
          {#each professionals as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>
    {/if}
  {/if}

  {#if categories.length > 0}
    <div class="form-group">
      <span class="field-label">Categorias</span>
      <div class="category-grid">
        {#each categories as cat}
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedCategoryIds.includes(cat.id)}
              onchange={() => toggleCategory(cat.id)}
              disabled={uploading}
            />
            {cat.name}
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if error}
    <p class="error-msg">{error}</p>
  {/if}
  {#if success}
    <p class="success-msg">{success}</p>
  {/if}

  <button
    type="button"
    class="btn btn-primary"
    onclick={upload}
    disabled={!selectedFile || uploading}
  >
    {uploading ? 'Enviando...' : 'Enviar Arquivo'}
  </button>
</div>

<style>
  .file-upload {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-top: 16px;
  }

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--text-muted);
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .category-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    transition: border-color 0.2s;
  }

  .checkbox-label:hover {
    border-color: var(--accent);
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    padding: 0;
    margin: 0;
    border: none;
    accent-color: var(--accent);
  }
</style>
