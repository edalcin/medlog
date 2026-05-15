<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Consultation } from '../lib/api'

  type GroupedMonth = { monthLabel: string; consultations: Consultation[] }
  type GroupedYear = { year: number; months: GroupedMonth[] }

  let loading = $state(true)
  let error = $state('')
  let grouped = $state<GroupedYear[]>([])

  onMount(async () => {
    try {
      const res = await api.getConsultations()
      grouped = buildTimeline(res.data)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar relatório'
    } finally {
      loading = false
    }
  })

  function buildTimeline(consultations: Consultation[]): GroupedYear[] {
    const byYear = new Map<number, Map<string, Consultation[]>>()

    for (const c of consultations) {
      const d = new Date(c.date)
      const year = d.getFullYear()
      const monthKey = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

      if (!byYear.has(year)) byYear.set(year, new Map())
      const months = byYear.get(year)!
      if (!months.has(monthKey)) months.set(monthKey, [])
      months.get(monthKey)!.push(c)
    }

    return Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({
        year,
        months: Array.from(months.entries())
          .sort((a, b) => {
            const da = new Date(b[1][0].date)
            const db = new Date(a[1][0].date)
            return da.getTime() - db.getTime()
          })
          .map(([monthLabel, consultations]) => ({ monthLabel, consultations })),
      }))
  }

  function formatDay(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', weekday: 'short' })
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Linha do Tempo</h1>
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if grouped.length === 0}
    <div class="empty">Nenhuma consulta registrada.</div>
  {:else}
    {#each grouped as yearGroup}
      <div class="year-section">
        <div class="year-label">{yearGroup.year}</div>

        {#each yearGroup.months as monthGroup}
          <div class="month-section">
            <div class="month-label">{monthGroup.monthLabel}</div>

            <div class="timeline">
              {#each monthGroup.consultations as c (c.id)}
                <div
                  class="timeline-item"
                  onclick={() => push(`/consultations/${c.id}`)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && push(`/consultations/${c.id}`)}
                >
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-top">
                      <span class="tl-date">{formatDay(c.date)}</span>
                      <span class="badge {c.type === 'CONSULTA' ? 'badge-blue' : 'badge-yellow'}">{c.type}</span>
                      {#if c.professional}
                        <span class="tl-pro">{c.professional.name}</span>
                      {/if}
                    </div>
                    {#if c.proposito}
                      <div class="tl-proposito">{c.proposito}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .year-section {
    margin-bottom: 32px;
  }

  .year-label {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 20px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }

  .month-section {
    margin-bottom: 24px;
  }

  .month-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-left: 20px;
    border-left: 2px solid var(--border);
  }

  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 10px 0;
    cursor: pointer;
    position: relative;
  }

  .timeline-dot {
    position: absolute;
    left: -27px;
    top: 16px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 2px solid var(--accent);
    flex-shrink: 0;
  }

  .timeline-item:hover .timeline-dot {
    background: var(--accent);
  }

  .timeline-content {
    flex: 1;
    padding: 10px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.2s;
  }

  .timeline-item:hover .timeline-content {
    border-color: var(--accent);
  }

  .timeline-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tl-date {
    font-size: 13px;
    color: var(--text-muted);
    min-width: 80px;
  }

  .tl-pro {
    font-weight: 500;
    font-size: 14px;
  }

  .tl-proposito {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
