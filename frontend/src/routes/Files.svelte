<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { MedFile, FileCategory, Professional } from '../lib/api'
  import { isAdmin } from '../lib/auth'
  import FileUpload from '../components/FileUpload.svelte'
  import FileEditModal from '../components/FileEditModal.svelte'
  import { localDate } from '../lib/date'

  const LIMIT = 20

  let files = $state<MedFile[]>([])
  let loading = $state(true)
  let loadingMore = $state(false)
  let error = $state('')
  let page = $state(1)
  let total = $state(0)
  let sentinel = $state<HTMLElement | undefined>(undefined)
  let hasMore = $derived(files.length < total)

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

  let hasFilters = $derived(!!(filterCategory || filterProfessional))

  async function reload() {
    loading = true
    page = 1
    files = []
    total = 0
    error = ''
    try {
      const res = await api.getMyFiles(1, LIMIT, {
        sort: sortCol,
        dir: sortDir,
        categoryId: filterCategory || undefined,
        professionalId: filterProfessional || undefined,
      })
      files = res.data
      total = res.total
      page = 2
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar arquivos'
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    loadingMore = true
    try {
      const res = await api.getMyFiles(page, LIMIT, {
        sort: sortCol,
        dir: sortDir,
        categoryId: filterCategory || undefined,
        professionalId: filterProfessional || undefined,
      })
      files = [...files, ...res.data]
      total = res.total
      page++
    } catch { /* silent */ } finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (!sentinel) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  })

  onMount(async () => {
    const [catRes, profRes] = await Promise.all([
      api.getCategories(),
      api.getProfessionals(false, 1, 1000),
    ])
    allCategories = catRes.data
    allProfessionals = profRes.data
    await reload()
  })

  async function applyFilter() {
    await reload()
  }

  async function clearFilters() {
    filterCategory = ''
    filterProfessional = ''
    await reload()
  }

  function sortBy(col: string) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      sortCol = col
      sortDir = col === 'uploadedAt' ? 'desc' : 'asc'
    }
    reload()
  }

  function sortIcon(col: string): string {
    if (sortCol !== col) return ' ⇅'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function onUploaded(f: MedFile) {
    showUpload = false
    reload()
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
    return localDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
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
      <option value="">Todas categorias</option>
      {#each allCategories as cat}
        <option value={cat.id}>{cat.name}</option>
      {/each}
    </select>

    <select bind:value={filterProfessional} onchange={applyFilter}>
      <option value="">Todos profissionais</option>
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

  {#if loading && files.length === 0}
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
            {#if $isAdmin}
              <th>Usuário</th>
            {/if}
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
              {#if $isAdmin}
                <td class="nowrap">{f.userName ?? '—'}</td>
              {/if}
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
    {#if hasMore}
      <div class="sentinel" bind:this={sentinel}></div>
      {#if loadingMore}<div class="loading-more">Carregando mais...</div>{/if}
    {:else if !loading && files.length > 0}
      <p class="list-end">— {total} arquivo{total !== 1 ? 's' : ''} —</p>
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

  .sentinel { height: 1px; }
  .loading-more {
    text-align: center;
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .list-end {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
