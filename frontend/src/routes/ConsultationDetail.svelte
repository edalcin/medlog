<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Consultation, Professional } from '../lib/api'
  import MarkdownPreview from '../components/MarkdownPreview.svelte'
  import FileUpload from '../components/FileUpload.svelte'
  import FileAttachModal from '../components/FileAttachModal.svelte'
  import StarRating from '../components/StarRating.svelte'
  import TipTapEditor from '../components/TipTapEditor.svelte'
  import { localDate } from '../lib/date'

  let { params } = $props<{ params: Record<string, string> }>()

  let consultation = $state<Consultation | null>(null)
  let professionals = $state<Professional[]>([])
  let loading = $state(true)
  let error = $state('')
  let editing = $state(false)
  let saving = $state(false)
  let saveError = $state('')
  let deleting = $state(false)
  let attachOpen = $state(false)

  // Edit form state
  let editDate = $state('')
  let editType = $state('')
  let editProposito = $state('')
  let editNotes = $state('')
  let editProfessionalId = $state('')
  let editRating = $state<number | undefined>(undefined)

  onMount(async () => {
    try {
      const [c, pros] = await Promise.all([
        api.getConsultation(params.id),
        api.getProfessionalsAll(),
      ])
      consultation = c
      professionals = pros.data
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar consulta'
    } finally {
      loading = false
    }
  })

  function startEdit() {
    if (!consultation) return
    editDate = consultation.date.split('T')[0]
    editType = consultation.type
    editProposito = consultation.proposito ?? ''
    editNotes = consultation.notes ?? ''
    editProfessionalId = consultation.professionalId ?? ''
    editRating = consultation.rating
    editing = true
    saveError = ''
  }

  async function saveEdit() {
    if (!consultation) return
    saving = true
    saveError = ''
    try {
      const updated = await api.updateConsultation(consultation.id, {
        date: editDate,
        type: editType,
        proposito: editProposito || undefined,
        notes: editNotes || undefined,
        professionalId: editProfessionalId || undefined,
        rating: editRating,
      })
      consultation = updated
      editing = false
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : 'Erro ao salvar'
    } finally {
      saving = false
    }
  }

  async function deleteConsultation() {
    if (!consultation) return
    if (!confirm('Excluir esta consulta e todos os seus arquivos?')) return
    deleting = true
    try {
      await api.deleteConsultation(consultation.id)
      push('/consultations')
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao excluir'
      deleting = false
    }
  }

  async function deleteFile(fileId: string) {
    if (!consultation) return
    if (!confirm('Excluir este arquivo?')) return
    try {
      await api.deleteFile(fileId)
      consultation = {
        ...consultation,
        files: consultation.files.filter(f => f.id !== fileId),
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao excluir arquivo'
    }
  }

  function onFileUploaded(file: import('../lib/api').MedFile) {
    if (!consultation) return
    consultation = { ...consultation, files: [...consultation.files, file] }
  }

  function onFilesAttached(newFiles: import('../lib/api').MedFile[]) {
    if (!consultation) return
    const existing = new Set(consultation.files.map(f => f.id))
    consultation = { ...consultation, files: [...consultation.files, ...newFiles.filter(f => !existing.has(f.id))] }
    attachOpen = false
  }

  function formatDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function fileBadgeClass(mime: string): string {
    if (mime === 'application/pdf') return 'badge-red'
    if (mime.startsWith('image/')) return 'badge-blue'
    return 'badge-yellow'
  }

  function fileMimeLabel(mime: string): string {
    if (mime === 'application/pdf') return 'PDF'
    if (mime === 'image/png') return 'PNG'
    if (mime === 'image/jpeg') return 'JPG'
    return mime
  }
</script>

<div class="page">
  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if consultation}
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-back" onclick={() => push('/consultations')}>← Voltar</button>
        <h1>{formatDate(consultation.date)}</h1>
      </div>
      <div style="display:flex;gap:8px">
        {#if !editing}
          <button class="btn btn-secondary" onclick={startEdit}>Editar</button>
          <button class="btn btn-danger" onclick={deleteConsultation} disabled={deleting}>
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        {/if}
      </div>
    </div>

    {#if editing}
      <div class="card" style="margin-bottom:24px">
        <h3 style="margin-bottom:16px">Editar Consulta</h3>
        <div class="edit-grid">
          <div class="form-group">
            <label for="edit-date">Data</label>
            <input id="edit-date" type="date" bind:value={editDate} />
          </div>
          <div class="form-group">
            <label for="edit-type">Tipo</label>
            <select id="edit-type" bind:value={editType}>
              <option value="CONSULTATION">Consulta</option>
              <option value="EVENT">Evento</option>
            </select>
          </div>
          <div class="form-group">
            <span class="form-label">Avaliação</span>
            <StarRating bind:value={editRating} />
          </div>
          <div class="form-group">
            <label for="edit-professional">Profissional</label>
            <select id="edit-professional" bind:value={editProfessionalId}>
              <option value="">Nenhum</option>
              {#each professionals as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-proposito">Propósito</label>
          <input id="edit-proposito" type="text" bind:value={editProposito} placeholder="Motivo da consulta" />
        </div>
        {#key editing}
        <div class="form-group">
          <span class="form-label">Notas</span>
          <TipTapEditor bind:value={editNotes} disabled={saving} />
        </div>
        {/key}
        {#if saveError}
          <p class="error-msg" style="margin-bottom:12px">{saveError}</p>
        {/if}
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick={saveEdit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button class="btn btn-ghost" onclick={() => (editing = false)} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    {:else}
      <div class="detail-section">
        <div class="meta-row">
          <span class="badge {consultation.type === 'CONSULTATION' ? 'badge-blue' : 'badge-yellow'}">
            {consultation.type === 'CONSULTATION' ? 'Consulta' : 'Evento'}
          </span>
          {#if consultation.rating}
            <StarRating value={consultation.rating} readonly />
          {/if}
        </div>

        {#if consultation.professional}
          <div class="professional-card">
            <strong>{consultation.professional.name}</strong>
            {#if consultation.professional.specialties.length > 0}
              <div class="specialties">
                {#each consultation.professional.specialties as s}
                  <span class="badge badge-blue">{s.name}</span>
                {/each}
              </div>
            {/if}
            {#if consultation.professional.clinic}
              <div class="clinic-name">{consultation.professional.clinic.name}</div>
            {/if}
          </div>
        {/if}

        {#if consultation.proposito}
          <div class="detail-field">
            <span class="field-label">Propósito</span>
            <p>{consultation.proposito}</p>
          </div>
        {/if}

        {#if consultation.notes}
          <div class="detail-field">
            <span class="field-label">Notas</span>
            <div class="notes-box">
              <MarkdownPreview content={consultation.notes} />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Files section -->
    <div class="files-section">
      <h3>Arquivos ({consultation.files.length})</h3>
      {#if consultation.files.length > 0}
        <div class="files-list">
          {#each consultation.files as f (f.id)}
            <div class="file-item">
              <div class="file-info">
                <span class="badge {fileBadgeClass(f.mimeType)}">{fileMimeLabel(f.mimeType)}</span>
                <a href="/api/files/{f.filename}" target="_blank" rel="noopener">
                  {f.customName || f.filename}
                </a>
                {#if f.categories.length > 0}
                  <span class="file-cats">
                    {f.categories.map(c => c.name).join(', ')}
                  </span>
                {/if}
              </div>
              <div class="file-actions">
                <span class="file-size">{formatFileSize(f.size)}</span>
                <button
                  class="btn btn-ghost btn-xs"
                  onclick={() => deleteFile(f.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-small">Nenhum arquivo anexado.</p>
      {/if}

      <FileUpload
        consultationId={consultation.id}
        professionalId={consultation.professionalId}
        onUploaded={onFileUploaded}
      />
      <button class="btn btn-ghost" onclick={() => attachOpen = true}>
        Anexar arquivo existente
      </button>
      {#if attachOpen}
        <FileAttachModal
          consultationId={consultation.id}
          onAttached={onFilesAttached}
          onClose={() => attachOpen = false}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .btn-back {
    font-size: 13px;
    padding: 4px 10px;
    margin-bottom: 8px;
    display: inline-block;
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 32px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .rating {
    color: var(--warning);
    font-size: 16px;
  }

  .professional-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 18px;
  }

  .specialties {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .clinic-name {
    margin-top: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .detail-field .field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .notes-box {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .files-section {
    border-top: 1px solid var(--border);
    padding-top: 24px;
  }

  .files-section h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .files-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    gap: 12px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
  }

  .file-cats {
    font-size: 12px;
    color: var(--text-muted);
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .file-size {
    font-size: 12px;
    color: var(--text-muted);
  }

  .btn-xs {
    padding: 3px 10px;
    font-size: 12px;
  }

  .edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0 16px;
  }

  .empty-small {
    color: var(--text-muted);
    font-size: 13px;
    margin-bottom: 8px;
  }
</style>
