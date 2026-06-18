<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Consultation, Professional, Specialty } from '../lib/api'
  import { localDate } from '../lib/date'

  const LIMIT = 20

  let consultations = $state<Consultation[]>([])
  let professionals = $state<Professional[]>([])
  let specialties = $state<Specialty[]>([])
  let loading = $state(true)
  let loadingMore = $state(false)
  let error = $state('')
  let page = $state(1)
  let total = $state(0)
  let sentinel = $state<HTMLElement | undefined>(undefined)
  let hasMore = $derived(consultations.length < total)

  // Filters
  let filterProfessional = $state('')
  let filterSpecialty = $state('')
  let search = $state('')

  async function reload() {
    loading = true
    page = 1
    consultations = []
    total = 0
    error = ''
    try {
      const res = await api.getConsultations(1, LIMIT, filterProfessional, filterSpecialty)
      consultations = res.data
      total = res.total
      page = 2
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar consultas'
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    loadingMore = true
    try {
      const res = await api.getConsultations(page, LIMIT, filterProfessional, filterSpecialty)
      consultations = [...consultations, ...res.data]
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
    const [, prosRes, specsRes] = await Promise.all([
      reload(),
      api.getProfessionalsAll().catch(() => ({ data: [] as Professional[] })),
      api.getSpecialties().catch(() => ({ data: [] as Specialty[] })),
    ])
    professionals = prosRes.data
    specialties = specsRes.data
  })

  // When specialty changes, reset professional if no longer in filtered set
  let filteredProfessionals = $derived(
    filterSpecialty
      ? professionals.filter(p => p.specialties.some(s => s.id === filterSpecialty))
      : professionals
  )

  $effect(() => {
    if (filterProfessional && filteredProfessionals.length > 0 &&
        !filteredProfessionals.find(p => p.id === filterProfessional)) {
      filterProfessional = ''
    }
  })

  async function onFilterChange() {
    await reload()
  }

  // Client-side text search on all loaded items
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

  {#if loading && consultations.length === 0}
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
    {#if hasMore}
      <div class="sentinel" bind:this={sentinel}></div>
      {#if loadingMore}<div class="loading-more">Carregando mais...</div>{/if}
    {:else if !loading && consultations.length > 0}
      <p class="list-end">— {total} consulta{total !== 1 ? 's' : ''} —</p>
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
