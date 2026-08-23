<script lang="ts">
  import { onMount } from 'svelte'
  import { push, link } from '@keenmate/svelte-spa-router'
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

  // Extração por IA (somente ADMIN, somente PDF)
  let consentFile = $state<MedFile | null>(null)
  let consentAccepted = $state(false)
  let startingExtraction = $state(false)
  let consentError = $state('')
  let resetFile = $state<MedFile | null>(null)
  let resetting = $state(false)
  let resetError = $state('')

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
    const prompt = f.consultationId
      ? `"${name}" está vinculado a uma consulta e não pode ser excluído — deseja apenas desvincular?`
      : `Excluir "${name}"?`
    if (!confirm(prompt)) return
    try {
      const res = await api.deleteFile(f.id)
      if (res.disassociated) {
        files = files.map(x => (x.id === f.id ? { ...x, consultationId: undefined, consultationDate: undefined } : x))
      } else {
        files = files.filter(x => x.id !== f.id)
        total -= 1
      }
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

  function canExtract(f: MedFile): boolean {
    return $isAdmin && f.mimeType === 'application/pdf'
  }

  function statusLabel(f: MedFile): string {
    if (f.latestExtractionStatus === 'pending') return 'em andamento'
    if (f.latestExtractionStatus === 'failed') return 'falhou'
    return f.reviewCount > 0 ? 'aguardando revisão' : 'revisada'
  }

  function statusBadge(f: MedFile): string {
    if (f.latestExtractionStatus === 'pending') return 'badge badge-yellow'
    if (f.latestExtractionStatus === 'failed') return 'badge badge-red'
    return f.reviewCount > 0 ? 'badge badge-yellow' : 'badge badge-blue'
  }

  function askConsent(f: MedFile) {
    consentFile = f
    consentAccepted = false
    consentError = ''
  }

  function closeConsent() {
    if (startingExtraction) return
    consentFile = null
    consentAccepted = false
  }

  function onConsentBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeConsent()
  }

  async function startExtraction() {
    if (!consentFile || !consentAccepted) return
    startingExtraction = true
    consentError = ''
    try {
      const extraction = await api.createExtraction(consentFile.id)
      consentFile = null
      consentAccepted = false
      push(`/extractions/${extraction.id}/review`)
    } catch (e: unknown) {
      consentError = e instanceof Error ? e.message : 'Erro ao iniciar a extração'
    } finally {
      startingExtraction = false
    }
  }

  async function confirmReset() {
    if (!resetFile) return
    resetting = true
    resetError = ''
    try {
      await api.resetFileExtractions(resetFile.id)
      resetFile = null
      await reload()
    } catch (e: unknown) {
      resetError = e instanceof Error ? e.message : 'Erro ao zerar a extração'
    } finally {
      resetting = false
    }
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
                {#if canExtract(f) && f.extractionCount > 0 && f.latestExtractionId}
                  <div class="extraction-line">
                    <a href="/extractions/{f.latestExtractionId}/review" use:link>
                      {f.extractionCount} extraç{f.extractionCount === 1 ? 'ão' : 'ões'}
                    </a>
                    <span class={statusBadge(f)}>{statusLabel(f)}</span>
                    <button class="link-danger" onclick={() => { resetFile = f; resetError = '' }}>
                      zerar
                    </button>
                  </div>
                {/if}
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
                {#if canExtract(f)}
                  <button
                    class="icon-btn"
                    onclick={() => askConsent(f)}
                    title="Extrair indicadores"
                  >
                    <i class="bx bx-brain"></i>
                  </button>
                {/if}
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
                  title={f.consultationId ? 'Desvincular da consulta' : 'Excluir'}
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

{#if consentFile}
  <div class="modal-backdrop" role="presentation" onclick={onConsentBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Consentimento para extração por IA">
      <div class="modal-header">
        <h3>Enviar este laudo para leitura por IA</h3>
        <button class="btn btn-ghost btn-xs" onclick={closeConsent} disabled={startingExtraction} aria-label="Fechar">✕</button>
      </div>

      <div class="modal-body">
        <p class="consent-file">{consentFile.customName || consentFile.filename}</p>

        <ul class="consent-list">
          <li>
            O documento <strong>sai deste servidor e é enviado ao Google (Gemini)</strong>,
            que faz a leitura do conteúdo.
          </li>
          <li>
            O laudo contém <strong>dados pessoais e de saúde</strong> — incluindo nome e data
            de nascimento — e <strong>não é anonimizado</strong> antes do envio.
          </li>
          <li>
            A leitura custa <strong>cerca de US$ 0,02 por laudo</strong>, cobrados na conta
            Google configurada.
          </li>
          <li>
            Nada do que a IA extrair passa a valer automaticamente: os indicadores ficam
            <strong>em revisão</strong> até que um humano confirme.
          </li>
        </ul>

        <label class="consent-check">
          <input type="checkbox" bind:checked={consentAccepted} disabled={startingExtraction} />
          <span>Li os quatro pontos acima e autorizo o envio deste documento ao Google.</span>
        </label>

        {#if consentError}
          <p class="error-msg">{consentError}</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={closeConsent} disabled={startingExtraction}>Cancelar</button>
        <button
          class="btn btn-primary"
          onclick={startExtraction}
          disabled={!consentAccepted || startingExtraction}
        >
          {startingExtraction ? 'Enviando...' : 'Autorizar e extrair'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if resetFile}
  <div class="modal-backdrop" role="presentation" onclick={e => { if (e.target === e.currentTarget && !resetting) resetFile = null }}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Zerar extração do documento">
      <div class="modal-header">
        <h3>Zerar a extração deste documento</h3>
        <button class="btn btn-ghost btn-xs" onclick={() => (resetFile = null)} disabled={resetting} aria-label="Fechar">✕</button>
      </div>

      <div class="modal-body">
        <p class="consent-file">{resetFile.customName || resetFile.filename}</p>
        <p class="reset-warning">
          Apaga a extração e <strong>todas as Observações vindas deste documento</strong>, as
          confirmadas inclusive. Os valores somem das séries e o documento volta ao estado de antes
          da primeira extração. Serve para recomeçar do zero, por exemplo com outro modelo.
        </p>
        <p class="reset-note">
          O documento em si, seus metadados e suas categorias não são tocados. Não há desfazer:
          recuperar exige extrair de novo, o que custa uma nova chamada.
        </p>
        {#if resetError}<p class="error-msg">{resetError}</p>{/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={() => (resetFile = null)} disabled={resetting}>Cancelar</button>
        <button class="btn btn-danger" onclick={confirmReset} disabled={resetting}>
          {resetting ? 'Apagando...' : 'Zerar extração'}
        </button>
      </div>
    </div>
  </div>
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

  .extraction-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12px;
  }

  .link-danger {
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    color: var(--danger);
    cursor: pointer;
    text-decoration: underline;
  }

  .reset-warning {
    font-size: 13px;
    line-height: 1.6;
  }

  .reset-note {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
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

  .consent-file {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    word-break: break-all;
  }

  .consent-list {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .consent-list strong {
    color: var(--text);
  }

  .consent-check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .consent-check input {
    width: 16px;
    height: 16px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--accent);
  }
</style>
