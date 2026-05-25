<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { MedFile, FileCategory, Professional } from '../lib/api'
  import { isAdmin } from '../lib/auth'
  import FileUpload from '../components/FileUpload.svelte'
  import FileEditModal from '../components/FileEditModal.svelte'

  let files = $state<MedFile[]>([])
  let loading = $state(true)
  let error = $state('')
  let page = $state(1)
  let total = $state(0)
  const limit = 20

  let showUpload = $state(false)
  let editing = $state<MedFile | null>(null)

  // Filters
  let allCategories = $state<FileCategory[]>([])
  let allProfessionals = $state<Professional[]>([])
  let filterCategory = $state('')
  let filterProfessional = $state('')

  // Sort
  let sortCol = $state('uploadedAt')
  let sortDir = $state<'asc' | 'desc'>('desc')

  onMount(async () => {
    const [catRes, profRes] = await Promise.all([
      api.getCategories(),
      api.getProfessionals(false, 1, 1000),
    ])
    allCategories = catRes.data
    allProfessionals = profRes.data
    await load()
  })

  async function load() {
    loading = true
    error = ''
    try {
      const res = await api.getMyFiles(page, limit, {
        sort: sortCol,
        dir: sortDir,
        categoryId: filterCategory || undefined,
        professionalId: filterProfessional || undefined,
      })
      files = res.data
      total = res.total
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar arquivos'
    } finally {
      loading = false
    }
  }

  async function applyFilter() {
    page = 1
    await load()
  }

  async function clearFilters() {
    filterCategory = ''
    filterProfessional = ''
    page = 1
    await load()
  }

  let totalPages = $derived(Math.max(1, Math.ceil(total / limit)))
  let hasFilters = $derived(!!(filterCategory || filterProfessional))

  async function goTo(p: number) {
    page = p
    await load()
  }

  function sortBy(col: string) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      sortCol = col
      sortDir = col === 'uploadedAt' ? 'desc' : 'asc'
    }
    page = 1
    load()
  }

  function sortIcon(col: string): string {
    if (sortCol !== col) return ' ⇅'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function onUploaded(f: MedFile) {
    showUpload = false
    page = 1
    load()
  }

  function onEditSaved(updated: MedFile) {
    files = files.map(f => (f.id === updated.id ? updated : f))
    editing = null
  }

  async function deleteFile(f: MedFile) {
    const name = f.customName || f.filename
    if (!confirm(`Excluir "${name}"?`)) return
    try {
      await api.deleteFile(f.id)
      files = files.filter(x => x.id !== f.id)
      total -= 1
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir arquivo.')
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function fileBadgeClass(mime: string): string {
    if (mime === 'application/pdf') return 'badge badge-red'
    if (mime === 'image/png' || mime === 'image/jpeg') return 'badge badge-blue'
    return 'badge'
  }

  function fileMimeLabel(mime: string): string {
    if (mime === 'application/pdf') return 'PDF'
    if (mime === 'image/png') return 'PNG'
    if (mime === 'image/jpeg') return 'JPG'
    return mime
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Arquivos</h1>
    <button class="btn btn-primary" onclick={() => (showUpload = !showUpload)}>
      {showUpload ? 'Cancelar' : 'Adicionar Arquivo'}
    </button>
  </div>

  {#if showUpload}
    <div style="margin-bottom: 24px">
      <FileUpload showConsultationPicker={true} showOwnerPicker={$isAdmin} onUploaded={onUploaded} />
    </div>
  {/if}

  <!-- Filter bar -->
  <div class="filter-bar" class:hidden={showUpload}>
    <select bind:value={filterCategory} onchange={applyFilter}>
      <option value="">Todas as categorias</option>
      {#each allCategories as cat}
        <option value={cat.id}>{cat.name}</option>
      {/each}
    </select>

    <select bind:value={filterProfessional} onchange={applyFilter}>
      <option value="">Todos os profissionais</option>
      {#each allProfessionals as p}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>

    {#if hasFilters}
      <button class="btn btn-ghost btn-sm" onclick={clearFilters}>✕ Limpar filtros</button>
    {/if}

    {#if total > 0}
      <span class="filter-count">{total} arquivo{total !== 1 ? 's' : ''}</span>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if files.length === 0}
    <div class="empty-state">
      {#if hasFilters}
        <p>Nenhum arquivo encontrado com os filtros selecionados.</p>
        <button class="btn btn-ghost" onclick={clearFilters}>Limpar filtros</button>
      {:else}
        <p>Nenhum arquivo encontrado.</p>
        <p class="text-muted">Clique em "Adicionar Arquivo" para enviar seu primeiro arquivo.</p>
      {/if}
    </div>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>
              <button class="sort-btn" onclick={() => sortBy('name')}>
                Nome{sortIcon('name')}
              </button>
            </th>
            <th>Tipo</th>
            <th>Categorias</th>
            <th>
              <button class="sort-btn" onclick={() => sortBy('uploadedAt')}>
                Data{sortIcon('uploadedAt')}
              </button>
            </th>
            <th>
              <button class="sort-btn" onclick={() => sortBy('professionalName')}>
                Profissional{sortIcon('professionalName')}
              </button>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each files as f (f.id)}
            <tr>
              <td>
                <a
                  href="/api/files/{f.filename}"
                  target="_blank"
                  rel="noopener"
                  class="file-link"
                >
                  {f.customName || f.filename}
                </a>
              </td>
              <td>
                <span class={fileBadgeClass(f.mimeType)}>{fileMimeLabel(f.mimeType)}</span>
              </td>
              <td>
                <div class="badge-list">
                  {#each f.categories as cat}
                    <span class="badge badge-gray">{cat.name}</span>
                  {/each}
                  {#if f.categories.length === 0}
                    <span class="text-muted">—</span>
                  {/if}
                </div>
              </td>
              <td class="nowrap">{formatDate(f.consultationDate ?? f.uploadedAt)}</td>
              <td>{f.professionalName ?? '—'}</td>
              <td class="actions-cell">
                <button
                  class="icon-btn"
                  onclick={() => f.consultationId && push(`/consultations/${f.consultationId}`)}
                  disabled={!f.consultationId}
                  title={f.consultationId ? 'Ver consulta' : 'Sem consulta vinculada'}
                >
                  <i class="bx bx-link-external"></i>
                </button>
                <button
                  class="icon-btn"
                  onclick={() => (editing = f)}
                  title="Editar"
                >
                  <i class="bx bx-edit-alt"></i>
                </button>
                <button
                  class="icon-btn icon-btn-danger"
                  onclick={() => deleteFile(f)}
                  title="Excluir"
                >
                  <i class="bx bx-trash"></i>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <button class="btn btn-ghost" disabled={page <= 1} onclick={() => goTo(page - 1)}>
          ‹ Anterior
        </button>
        <span class="page-info">Página {page} de {totalPages} · {total} total</span>
        <button class="btn btn-ghost" disabled={page >= totalPages} onclick={() => goTo(page + 1)}>
          Próxima ›
        </button>
      </div>
    {/if}
  {/if}
</div>

{#if editing}
  <FileEditModal
    file={editing}
    onSaved={onEditSaved}
    onClose={() => (editing = null)}
  />
{/if}

<style>
  .filter-bar.hidden {
    display: none;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .filter-bar select {
    font-size: 13px;
    padding: 5px 10px;
    min-width: 160px;
  }

  .filter-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-muted);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .table-wrapper table {
    min-width: 700px;
  }

  .sort-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: inherit;
    font-weight: 600;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
    letter-spacing: inherit;
  }

  .sort-btn:hover {
    color: var(--accent);
  }

  .file-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 13px;
  }

  .file-link:hover {
    text-decoration: underline;
  }

  .badge-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .nowrap {
    white-space: nowrap;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-state p {
    margin: 0;
  }

  .text-muted {
    color: var(--text-muted);
    font-size: 13px;
  }

</style>
