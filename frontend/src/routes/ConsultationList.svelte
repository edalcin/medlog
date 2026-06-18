<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Consultation, Professional, Specialty } from '../lib/api'
  import { localDate } from '../lib/date'

  let consultations = $state<Consultation[]>([])
  let professionals = $state<Professional[]>([])
  let specialties = $state<Specialty[]>([])
  let loading = $state(true)
  let error = $state('')
  let page = $state(1)
  let total = $state(0)
  const limit = 20

  // Filters
  let filterProfessional = $state('')
  let filterSpecialty = $state('')
  let search = $state('')
  let searchDebounce: ReturnType<typeof setTimeout>

  async function load() {
    loading = true
    error = ''
    try {
      const res = await api.getConsultations(page, limit, filterProfessional, filterSpecialty)
      consultations = res.data
      total = res.total
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar consultas'
    } finally {
      loading = false
    }
  }

  onMount(async () => {
    const [, prosRes, specsRes] = await Promise.all([
      load(),
      api.getProfessionalsAll().catch(() => ({ data: [] as Professional[] })),
      api.getSpecialties().catch(() => ({ data: [] as Specialty[] })),
    ])
    professionals = prosRes.data
    specialties = specsRes.data
  })

  let totalPages = $derived(Math.max(1, Math.ceil(total / limit)))

  // When specialty changes, reset professional if that professional no longer matches
  let filteredProfessionals = $derived(
    filterSpecialty
      ? professionals.filter(p => p.specialties.some(s => s.id === filterSpecialty))
      : professionals
  )

  // If the currently selected professional isn't in the filtered list, clear it
  $effect(() => {
    if (filterProfessional && filteredProfessionals.length > 0 &&
        !filteredProfessionals.find(p => p.id === filterProfessional)) {
      filterProfessional = ''
    }
  })

  async function goTo(p: number) {
    page = p
    await load()
  }

  async function onFilterChange() {
    page = 1
    await load()
  }

  // Client-side text search on the already-loaded page
  let filtered = $derived(
    search.trim()
      ? consultations.filter(c =>
          c.professional?.name.toLowerCase().includes(search.toLowerCase()) ||
          c.proposito?.toLowerCase().includes(search.toLowerCase())
        )
      : consultations
  )

  function formatDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Consultas</h1>
    <button class="btn btn-primary" onclick={() => push('/consultations/new')}>
      Nova Consulta
    </button>
  </div>

  <div class="filters">
    <select bind:value={filterSpecialty} onchange={onFilterChange}>
      <option value="">Todas especialidades</option>
      {#each specialties as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
    <select bind:value={filterProfessional} onchange={onFilterChange}>
      <option value="">Todos profissionais</option>
      {#each filteredProfessionals as p}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
    <input
      type="search"
      bind:value={search}
      placeholder="Buscar por profissional ou propósito..."
    />
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if filtered.length === 0}
    <div class="empty">
      {#if filterProfessional || filterSpecialty || search}
        Nenhuma consulta encontrada para os filtros aplicados.
      {:else}
        Nenhuma consulta registrada ainda.
        <br />
        <button class="btn btn-primary" style="margin-top:16px" onclick={() => push('/consultations/new')}>
          Registrar primeira consulta
        </button>
      {/if}
    </div>
  {:else}
    <div class="list">
      {#each filtered as c (c.id)}
        <div
          class="consultation-item"
          onclick={() => push(`/consultations/${c.id}`)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && push(`/consultations/${c.id}`)}
        >
          <div class="item-date">{formatDate(c.date)}</div>
          <div class="item-body">
            <div class="item-top">
              <span class="badge {c.type === 'CONSULTATION' ? 'badge-blue' : 'badge-yellow'}">{c.type === 'CONSULTATION' ? 'Consulta' : 'Evento'}</span>
              {#if c.professional}
                <span class="professional-name">{c.professional.name}</span>
                {#if c.professional.specialties.length > 0}
                  <span class="specialty-hint">— {c.professional.specialties[0].name}</span>
                {/if}
              {/if}
            </div>
            {#if c.proposito}
              <div class="proposito">{c.proposito}</div>
            {/if}
          </div>
          <div class="item-meta">
            {#if c.files.length > 0}
              <span class="file-count">{c.files.length} arq.</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {#if totalPages > 1}
      <div class="pagination">
        <button class="btn btn-ghost" disabled={page <= 1} onclick={() => goTo(page - 1)}>‹ Anterior</button>
        <span class="page-info">Página {page} de {totalPages} · {total} total</span>
        <button class="btn btn-ghost" disabled={page >= totalPages} onclick={() => goTo(page + 1)}>Próxima ›</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .filters {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .filters select {
    padding: 6px 10px;
    font-size: 13px;
  }

  .filters input[type="search"] {
    flex: 1;
    min-width: 200px;
    padding: 6px 10px;
    font-size: 13px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .consultation-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 14px 18px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .consultation-item:hover {
    border-color: var(--accent);
  }

  .item-date {
    min-width: 120px;
    font-size: 13px;
    color: var(--text-muted);
    padding-top: 2px;
  }

  .item-body {
    flex: 1;
  }

  .item-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .professional-name {
    font-weight: 500;
  }

  .specialty-hint {
    font-size: 13px;
    color: var(--text-muted);
  }

  .proposito {
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 500px;
  }

  .item-meta {
    display: flex;
    align-items: center;
  }

  .file-count {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 24px;
  }

  .page-info {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
