<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Professional, Specialty, Clinic } from '../lib/api'
  import StarRating from '../components/StarRating.svelte'

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

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Profissionais</h1>
    <button class="btn btn-primary" onclick={() => push('/professionals/new')}>
      Novo Profissional
    </button>
  </div>
  <div class="filters">
    <select bind:value={filterSpecialty} onchange={onFilterChange}>
      <option value="">Todas especialidades</option>
      {#each specialties as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
    <select bind:value={filterClinic} onchange={onFilterChange}>
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
    />
    <button class="btn btn-ghost" onclick={toggleFilter}>
      {activeOnly ? 'Ver todos' : 'Apenas ativos'}
    </button>
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
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-pro">Profissional</th>
            <th class="col-rating">Avaliação</th>
            <th class="col-consults">Consultas</th>
          </tr>
        </thead>
        <tbody>
          {#each all as p (p.id)}
            <tr class:shared={p.isShared}>
              <td class="col-pro">
                <div class="pro-name-row">
                  <button
                    class="pro-name-btn"
                    disabled={p.isShared}
                    onclick={() => !p.isShared && push(`/professionals/${p.id}`)}
                  >{p.name}</button>
                  {#if p.isShared}
                    <span class="badge badge-yellow" title="Compartilhado por outro usuário">Compartilhado</span>
                  {:else if !p.isActive}
                    <span class="badge badge-red">Inativo</span>
                  {:else}
                    <span class="badge badge-green">Ativo</span>
                  {/if}
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
              </td>
              <td class="col-rating">
                {#if p.totalRatings}
                  <div class="rating-cell">
                    <StarRating value={p.avgRating} readonly />
                    <span class="rating-count">({p.totalRatings})</span>
                  </div>
                {:else}
                  <span class="no-consults">—</span>
                {/if}
              </td>
              <td class="col-consults">
                {#if p.consultations.length === 0}
                  <span class="no-consults">—</span>
                {:else}
                  <div class="consult-tags">
                    {#each p.consultations as c}
                      <button
                        class="consult-tag"
                        onclick={() => push(`/consultations/${c.id}`)}
                        title="Ver consulta de {fmtDate(c.date)}"
                      >{fmtDate(c.date)}</button>
                    {/each}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
    margin-bottom: 16px;
  }

  .filters select,
  .filters input {
    padding: 6px 10px;
    font-size: 13px;
  }

  .filters input {
    min-width: 180px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  thead th {
    text-align: left;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid var(--border);
  }

  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }

  tbody tr:hover {
    background: var(--bg-hover, rgba(0,0,0,0.03));
  }

  tbody tr.shared {
    opacity: 0.75;
  }

  td {
    padding: 12px 14px;
    vertical-align: top;
  }

  .col-pro {
    width: 40%;
    min-width: 220px;
  }

  .col-rating {
    width: 130px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .col-consults {
    width: 60%;
  }

  .rating-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rating-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .pro-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .pro-name-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  .pro-name-btn:hover:not(:disabled) {
    color: var(--accent);
    text-decoration: underline;
  }

  .pro-name-btn:disabled {
    cursor: default;
  }

  .pro-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .specialties {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .clinic {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .consult-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .consult-tag {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .consult-tag:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .no-consults {
    color: var(--text-muted);
    font-size: 13px;
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
