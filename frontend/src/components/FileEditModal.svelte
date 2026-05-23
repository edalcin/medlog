<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { MedFile, FileCategory, Consultation, Professional } from '../lib/api'

  let {
    file,
    onSaved,
    onClose,
  } = $props<{
    file: MedFile
    onSaved: (updated: MedFile) => void
    onClose: () => void
  }>()

  let categories = $state<FileCategory[]>([])
  let consultations = $state<Consultation[]>([])
  let professionals = $state<Professional[]>([])

  let customName = $state('')
  let selectedConsultationId = $state('')
  let selectedProfessionalId = $state('')
  let selectedCategoryIds = $state<string[]>([])

  $effect(() => {
    customName = file.customName ?? ''
    selectedConsultationId = file.consultationId ?? ''
    selectedProfessionalId = file.professionalId ?? ''
    selectedCategoryIds = file.categories.map(c => c.id)
  })

  let saving = $state(false)
  let error = $state('')
  let newCategoryName = $state('')
  let addingCategory = $state(false)

  onMount(async () => {
    try {
      const [catRes, consultRes, profRes] = await Promise.all([
        api.getCategories(),
        api.getConsultations(1, 1000),
        api.getProfessionals(false, 1, 1000),
      ])
      categories = catRes.data
      consultations = consultRes.data
      professionals = profRes.data
    } catch {
      // ignore load errors
    }
  })

  function toggleCategory(id: string) {
    if (selectedCategoryIds.includes(id)) {
      selectedCategoryIds = selectedCategoryIds.filter(c => c !== id)
    } else {
      selectedCategoryIds = [...selectedCategoryIds, id]
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    addingCategory = true
    try {
      const cat = await api.createCategory(newCategoryName.trim())
      categories = [...categories, cat]
      selectedCategoryIds = [...selectedCategoryIds, cat.id]
      newCategoryName = ''
    } catch {
      // ignore
    } finally {
      addingCategory = false
    }
  }

  async function save() {
    saving = true
    error = ''
    try {
      const updated = await api.updateFile(file.id, {
        customName: customName.trim() || null,
        consultationId: selectedConsultationId || null,
        professionalId: selectedProfessionalId || null,
        categoryIds: selectedCategoryIds,
      })
      onSaved(updated)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao salvar.'
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
  <div class="modal" role="dialog" aria-modal="true" aria-label="Editar arquivo">
    <div class="modal-header">
      <h3>Editar Arquivo</h3>
      <button class="btn btn-ghost btn-xs" onclick={onClose} aria-label="Fechar">✕</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="edit-name">Nome personalizado</label>
        <input
          type="text"
          id="edit-name"
          bind:value={customName}
          placeholder={file.filename}
          disabled={saving}
        />
      </div>

      <div class="form-group">
        <label for="edit-consult">Consulta vinculada</label>
        <select id="edit-consult" bind:value={selectedConsultationId} disabled={saving}>
          <option value="">— Nenhuma —</option>
          {#each consultations as c}
            <option value={c.id}>
              {new Date(c.date).toLocaleDateString('pt-BR')}
              {c.professional?.name ? ' · ' + c.professional.name : ''}
            </option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="edit-prof">Profissional vinculado</label>
        <select id="edit-prof" bind:value={selectedProfessionalId} disabled={saving}>
          <option value="">— Nenhum —</option>
          {#each professionals as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <span class="field-label">Categorias</span>
        <div class="category-grid">
          {#each categories as cat}
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={selectedCategoryIds.includes(cat.id)}
                onchange={() => toggleCategory(cat.id)}
                disabled={saving}
              />
              {cat.name}
            </label>
          {/each}
        </div>
        <div class="add-category-row">
          <input
            type="text"
            bind:value={newCategoryName}
            placeholder="Nova categoria..."
            disabled={addingCategory || saving}
            onkeydown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button
            class="btn btn-ghost btn-xs"
            onclick={addCategory}
            disabled={!newCategoryName.trim() || addingCategory || saving}
          >
            {addingCategory ? '...' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick={onClose} disabled={saving}>Cancelar</button>
      <button class="btn btn-primary" onclick={save} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar'}
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
    gap: 16px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
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
    margin-bottom: 8px;
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

  .add-category-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .add-category-row input {
    flex: 1;
    font-size: 13px;
    padding: 4px 8px;
  }
</style>
