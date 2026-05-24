<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Professional, Specialty, Clinic } from '../lib/api'

  let all = $state<Professional[]>([])
  let specialties = $state<Specialty[]>([])
  let clinics = $state<Clinic[]>([])
  let loading = $state(true)
  let error = $state('')
  let activeOnly = $state(true)
  let page = $state(1)
  let total = $state(0)
  let search = $state('')
  let filterSpecialty = $state('')
  let filterClinic = $state('')
  let searchDebounce: ReturnType<typeof setTimeout>
  const limit = 20

  onMount(async () => {
    const [, specsRes, clinicsRes] = await Promise.all([
      load(),
      api.getSpecialties().catch(() => ({ data: [] as Specialty[] })),
      api.getClinics().catch(() => ({ data: [] as Clinic[] })),
    ])
    specialties = specsRes.data
    clinics = clinicsRes.data
  })

  async function load() {
    loading = true
    error = ''
    try {
      const res = await api.getProfessionals(activeOnly, page, limit, search, filterSpecialty, filterClinic)
      all = res.data
      total = res.total
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar profissionais'
    } finally {
      loading = false
    }
  }

  let totalPages = $derived(Math.max(1, Math.ceil(total / limit)))

  async function goTo(p: number) {
    page = p
    await load()
  }

  async function toggleFilter() {
    activeOnly = !activeOnly
    page = 1
    await load()
  }

  function onSearchInput() {
    clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      page = 1
      load()
    }, 300)
  }

  async function onFilterChange() {
    page = 1
    await load()
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Profissionais</h1>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select
        bind:value={filterSpecialty}
        onchange={onFilterChange}
        style="padding:6px 10px;font-size:13px"
      >
        <option value="">Todas especialidades</option>
        {#each specialties as s}
          <option value={s.id}>{s.name}</option>
        {/each}
      </select>
      <select
        bind:value={filterClinic}
        onchange={onFilterChange}
        style="padding:6px 10px;font-size:13px"
      >
        <option value="">Todas clínicas</option>
        {#each clinics as c}
          <option value={c.id}>{c.name}</option>
        {/each}
      </select>
      <input
        type="search"
        bind:value={search}
        oninput={onSearchInput}
        placeholder="Buscar por nome..."
        style="padding:6px 12px;font-size:13px;min-width:180px"
      />
      <button class="btn btn-ghost" onclick={toggleFilter}>
        {activeOnly ? 'Ver todos' : 'Apenas ativos'}
      </button>
      <button class="btn btn-primary" onclick={() => push('/professionals/new')}>
        Novo Profissional
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if all.length === 0}
    <div class="empty">
      Nenhum profissional {activeOnly ? 'ativo ' : ''}encontrado.
    </div>
  {:else}
    <div class="list">
      {#each all as p (p.id)}
        <div
          class="pro-item"
          class:shared={p.isShared}
          onclick={() => !p.isShared && push(`/professionals/${p.id}`)}
          role="button"
          tabindex={p.isShared ? -1 : 0}
          onkeydown={(e) => !p.isShared && e.key === 'Enter' && push(`/professionals/${p.id}`)}
        >
          <div class="pro-main">
            <span class="pro-name">{p.name}</span>
            {#if p.isShared}
              <span class="badge badge-yellow" title="Compartilhado por outro usuário">Compartilhado</span>
            {:else if !p.isActive}
              <span class="badge badge-red">Inativo</span>
            {:else}
              <span class="badge badge-green">Ativo</span>
            {/if}
            <span class="consult-count" title="Consultas registradas">
              <i class="bx bx-calendar-check"></i>
              {p.consultationCount}
            </span>
          </div>
          <div class="pro-meta">
            {#if p.specialties.length > 0}
              <div class="specialties">
                {#each p.specialties as s}
                  <span class="badge badge-blue">{s.name}</span>
                {/each}
              </div>
            {/if}
            {#if p.clinic}
              <span class="clinic"><i class="bx bx-building-house"></i> {p.clinic.name}</span>
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
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pro-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 18px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .pro-item:hover {
    border-color: var(--accent);
  }

  .pro-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pro-name {
    font-weight: 500;
    font-size: 15px;
  }

  .consult-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pro-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .specialties {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .clinic {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
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
