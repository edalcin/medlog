<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { FileCategory, MedFile } from '../lib/api'

  let {
    consultationId,
    professionalId,
    onUploaded,
  } = $props<{
    consultationId: string
    professionalId?: string
    onUploaded?: (file: MedFile) => void
  }>()

  let categories = $state<FileCategory[]>([])
  let selectedCategoryIds = $state<string[]>([])
  let selectedFile = $state<File | null>(null)
  let uploading = $state(false)
  let error = $state('')
  let success = $state('')

  onMount(async () => {
    try {
      const res = await api.getCategories()
      categories = res.data
    } catch {
      // Categories are optional — silently ignore load failure
    }
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
    error = ''
  }

  async function upload() {
    if (!selectedFile) return
    uploading = true
    error = ''
    success = ''
    try {
      const uploaded = await api.uploadFile(
        selectedFile,
        consultationId,
        professionalId,
        selectedCategoryIds
      )
      success = `Arquivo "${selectedFile.name}" enviado com sucesso.`
      selectedFile = null
      selectedCategoryIds = []
      // Reset file input
      const input = document.getElementById('file-input-' + consultationId) as HTMLInputElement
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

  <div class="form-group">
    <label for="file-input-{consultationId}">Arquivo (PDF, PNG, JPG — máx 10MB)</label>
    <input
      type="file"
      id="file-input-{consultationId}"
      accept=".pdf,.png,.jpg,.jpeg"
      onchange={onFileChange}
      disabled={uploading}
    />
  </div>

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
