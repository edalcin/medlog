<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Professional } from '../lib/api'

  let all = $state<Professional[]>([])
  let loading = $state(true)
  let error = $state('')
  let activeOnly = $state(true)

  onMount(async () => {
    await load()
  })

  async function load() {
    loading = true
    try {
      const res = await api.getProfessionals(activeOnly)
      all = res.data
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar profissionais'
    } finally {
      loading = false
    }
  }

  async function toggleFilter() {
    activeOnly = !activeOnly
    await load()
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Profissionais</h1>
    <div style="display:flex;gap:8px">
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
          onclick={() => push(`/professionals/${p.id}`)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && push(`/professionals/${p.id}`)}
        >
          <div class="pro-main">
            <span class="pro-name">{p.name}</span>
            {#if !p.isActive}
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
              <span class="clinic">{p.clinic.name}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
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
  }
</style>
