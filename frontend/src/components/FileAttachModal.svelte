<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { MedFile } from '../lib/api'
  import { localDate } from '../lib/date'

  let { consultationId, onAttached, onClose } = $props<{
    consultationId: string
    onAttached: (files: MedFile[]) => void
    onClose: () => void
  }>()

  let files = $state<MedFile[]>([])
  let loading = $state(true)
  let loadError = $state('')
  let search = $state('')
  let selectedIds = $state<string[]>([])
  let saving = $state(false)
  let error = $state('')

  onMount(async () => {
    try {
      const res = await api.getMyFiles(1, 100)
      files = res.data.filter(f => f.consultationId !== consultationId)
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : 'Erro ao carregar arquivos.'
    } finally {
      loading = false
    }
  })

  let filtered = $derived(
    search.trim()
      ? files.filter(f => {
          const q = search.trim().toLowerCase()
          return (f.customName ?? '').toLowerCase().includes(q) || f.filename.toLowerCase().includes(q)
        })
      : files
  )

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id)
    } else {
      selectedIds = [...selectedIds, id]
    }
  }

  async function attach() {
    saving = true
    error = ''
    try {
      const selected = files.filter(f => selectedIds.includes(f.id))
      // Sequential, not Promise.all: SQLite serializes writes anyway, and this
      // way a failure partway through leaves a clear, reportable boundary
      // (files before it attached, files from it on untouched) instead of an
      // all-or-nothing race across N concurrent transactions.
      const updated: MedFile[] = []
      for (const f of selected) {
        updated.push(await api.updateFile(f.id, {
          customName: f.customName ?? null,
          consultationId,
          professionalId: f.professionalId ?? null,
          categoryIds: f.categories.map(c => c.id),
        }))
      }
      onAttached(updated)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao anexar.'
    } finally {
      saving = false
    }
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-backdrop"
  role="presentation"
  onclick={onBackdropClick}
>
  <div class="modal" role="dialog" aria-modal="true" aria-label="Anexar arquivo existente">
    <div class="modal-header">
      <h3>Anexar Arquivo Existente</h3>
      <button class="btn btn-ghost btn-xs" onclick={onClose} aria-label="Fechar">✕</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <p class="loading">Carregando...</p>
      {:else if loadError}
        <p class="error-msg">{loadError}</p>
      {:else}
        <input
          type="text"
          bind:value={search}
          placeholder="Buscar arquivo..."
          disabled={saving}
        />

        {#if filtered.length === 0}
          <p class="empty">Nenhum arquivo disponível para anexar.</p>
        {:else}
          <div class="file-list">
            {#each filtered as f (f.id)}
              <label class="file-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(f.id)}
                  onchange={() => toggle(f.id)}
                  disabled={saving}
                />
                <span class="file-info">
                  <span class="file-name">{f.customName || f.filename}</span>
                  {#if f.userName}
                    <span class="file-hint">{f.userName}</span>
                  {/if}
                  {#if f.consultationId}
                    <span class="file-warning">
                      {f.consultationDate
                        ? `vinculado a consulta de ${localDate(f.consultationDate).toLocaleDateString('pt-BR')}`
                        : 'vinculado a outra consulta'}
                    </span>
                  {/if}
                </span>
              </label>
            {/each}
          </div>
        {/if}

        {#if error}
          <p class="error-msg">{error}</p>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick={onClose} disabled={saving}>Cancelar</button>
      <button class="btn btn-primary" onclick={attach} disabled={saving || selectedIds.length === 0}>
        {saving ? 'Anexando...' : `Anexar (${selectedIds.length})`}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }

  .loading,
  .empty {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 12px 0;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 320px;
    overflow-y: auto;
  }

  .file-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .file-row:hover {
    border-color: var(--accent);
  }

  .file-row input[type="checkbox"] {
    width: auto;
    margin: 2px 0 0;
    padding: 0;
    border: none;
    accent-color: var(--accent);
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .file-name {
    font-size: 13px;
    font-weight: 500;
    word-break: break-word;
  }

  .file-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .file-warning {
    font-size: 12px;
    color: var(--warning);
  }
</style>
