<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { MedFile } from '../lib/api'
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

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      const res = await api.getMyFiles(page, limit)
      files = res.data
      total = res.total
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar arquivos'
    } finally {
      loading = false
    }
  }

  let totalPages = $derived(Math.max(1, Math.ceil(total / limit)))

  async function goTo(p: number) {
    page = p
    await load()
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
      <FileUpload showConsultationPicker={true} onUploaded={onUploaded} />
    </div>
  {/if}

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if files.length === 0}
    <div class="empty-state">
      <p>Nenhum arquivo encontrado.</p>
      <p class="text-muted">Clique em "Adicionar Arquivo" para enviar seu primeiro arquivo.</p>
    </div>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Categorias</th>
            <th>Data</th>
            <th>Profissional</th>
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
              <td class="nowrap">{f.uploadedAt ? formatDate(f.uploadedAt) : '—'}</td>
              <td>{f.professionalName ?? '—'}</td>
              <td class="actions-cell">
                <button class="btn btn-ghost btn-xs" onclick={() => (editing = f)}>Editar</button>
                <button class="btn btn-danger btn-xs" onclick={() => deleteFile(f)}>Excluir</button>
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
  .table-wrapper {
    overflow-x: auto;
  }

  .table-wrapper table {
    min-width: 700px;
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
  }

  .empty-state p {
    margin: 4px 0;
  }

  .text-muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
