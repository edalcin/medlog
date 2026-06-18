<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import { currentUser } from '../lib/auth'
  import * as api from '../lib/api'
  import type { DashboardStats } from '../lib/api'
  import { localDate } from '../lib/date'

  let stats = $state<DashboardStats | null>(null)
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    try {
      stats = await api.getDashboard()
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar dashboard'
    } finally {
      loading = false
    }
  })

  function formatDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatMonth(m: string): string {
    const [year, month] = m.split('-')
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[parseInt(month) - 1]}/${year.slice(2)}`
  }

  function maxCount(arr: Array<{ count: number }>): number {
    return Math.max(...arr.map(d => d.count), 1)
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Dashboard</h1>
    <p class="subtitle">Bem-vindo, {$currentUser?.name}!</p>
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if stats}
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="card card-blue">
        <div class="card-label">Consultas</div>
        <div class="card-value">{stats.summary.totalConsultations}</div>
      </div>
      <div class="card card-orange">
        <div class="card-label">Outros registros</div>
        <div class="card-value">{stats.summary.totalEpisodes}</div>
      </div>
      <div class="card card-green">
        <div class="card-label">Profissionais</div>
        <div class="card-value">{stats.summary.totalProfessionals}</div>
      </div>
      <div class="card card-purple">
        <div class="card-label">Arquivos</div>
        <div class="card-value">{stats.summary.totalFiles}</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-grid">
      <!-- By Specialty -->
      <div class="panel">
        <h2>Por Especialidade</h2>
        {#if stats.bySpecialty.length > 0}
          <div class="bar-list">
            {#each stats.bySpecialty.slice(0, 8) as item}
              <div class="bar-row">
                <span class="bar-label">{item.name}</span>
                <div class="bar-track">
                  <div class="bar bar-blue" style="width: {(item.count / maxCount(stats.bySpecialty)) * 100}%"></div>
                </div>
                <span class="bar-count">{item.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhum dado disponível</p>
        {/if}
      </div>

      <!-- By Clinic -->
      <div class="panel">
        <h2>Por Clínica</h2>
        {#if stats.byClinic.length > 0}
          <div class="bar-list">
            {#each stats.byClinic.slice(0, 8) as item}
              <div class="bar-row">
                <span class="bar-label">{item.name}</span>
                <div class="bar-track">
                  <div class="bar bar-green" style="width: {(item.count / maxCount(stats.byClinic)) * 100}%"></div>
                </div>
                <span class="bar-count">{item.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhum dado disponível</p>
        {/if}
      </div>

      <!-- By Year -->
      <div class="panel">
        <h2>Por Ano</h2>
        {#if stats.byYear.length > 0}
          <div class="bar-list">
            {#each stats.byYear as item}
              <div class="bar-row">
                <span class="bar-label">{item.year}</span>
                <div class="bar-track">
                  <div class="bar bar-purple" style="width: {(item.count / maxCount(stats.byYear)) * 100}%"></div>
                </div>
                <span class="bar-count">{item.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhum dado disponível</p>
        {/if}
      </div>

      <!-- By Month -->
      <div class="panel panel-wide">
        <h2>Evolução Mensal (12 meses)</h2>
        {#if stats.byMonth.length > 0}
          <div class="month-chart">
            {#each stats.byMonth as item}
              <div class="month-col">
                <span class="month-count">{item.count}</span>
                <div class="month-bar-wrap">
                  <div
                    class="month-bar"
                    style="height: {Math.max((item.count / maxCount(stats.byMonth)) * 120, 4)}px"
                  ></div>
                </div>
                <span class="month-label">{formatMonth(item.month)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhum dado disponível</p>
        {/if}
      </div>
    </div>

    <!-- Bottom Row -->
    <div class="bottom-grid">
      <!-- Top Professionals -->
      <div class="panel">
        <h2>Mais Consultados</h2>
        {#if stats.byProfessional.length > 0}
          <div class="ranked-list">
            {#each stats.byProfessional as item, i}
              <div class="ranked-item">
                <span class="rank">{i + 1}</span>
                <div class="ranked-info">
                  <div class="ranked-name">{item.name}</div>
                  {#if item.specialty}
                    <div class="ranked-sub">{item.specialty}</div>
                  {/if}
                </div>
                <span class="ranked-count">{item.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhum dado disponível</p>
        {/if}
      </div>

      <!-- Top Rated -->
      <div class="panel">
        <h2>Melhor Avaliados</h2>
        {#if stats.topRatedProfessionals.length > 0}
          <div class="ranked-list">
            {#each stats.topRatedProfessionals as item, i}
              <div class="ranked-item ranked-item-gold">
                <span class="rank rank-gold">{i + 1}</span>
                <div class="ranked-info">
                  <div class="ranked-name">{item.name}</div>
                  {#if item.specialty}
                    <div class="ranked-sub">{item.specialty}</div>
                  {/if}
                </div>
                <div class="rating-info">
                  <span class="rating-value">★ {item.averageRating}</span>
                  <span class="rating-count">{item.totalRatings} aval.</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhuma avaliação registrada</p>
        {/if}
      </div>

      <!-- Recent Consultations -->
      <div class="panel">
        <div class="panel-header">
          <h2>Consultas Recentes</h2>
          <button class="link-btn" onclick={() => push('/consultations')}>Ver todas →</button>
        </div>
        {#if stats.recentConsultations.length > 0}
          <div class="recent-list">
            {#each stats.recentConsultations as item}
              <div class="recent-item" onclick={() => push(`/consultations/${item.id}`)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && push(`/consultations/${item.id}`)}>
                <div class="recent-info">
                  <div class="recent-name">{item.professionalName}</div>
                  <div class="recent-sub">{item.specialty}</div>
                </div>
                <span class="recent-date">{formatDate(item.date)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Nenhuma consulta registrada</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-bottom: 24px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 14px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .card {
    border-radius: var(--radius);
    padding: 20px 24px;
    color: #fff;
  }

  .card-blue   { background: linear-gradient(135deg, #2563eb, #3b82f6); }
  .card-orange { background: linear-gradient(135deg, #ea580c, #f97316); }
  .card-green  { background: linear-gradient(135deg, #16a34a, #22c55e); }
  .card-purple { background: linear-gradient(135deg, #7c3aed, #a855f7); }

  .card-label {
    font-size: 12px;
    opacity: 0.85;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .card-value {
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .panel-wide {
    grid-column: span 2;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .panel {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .panel h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 16px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .panel-header h2 {
    margin-bottom: 0;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
    padding: 0;
  }

  .bar-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 130px 1fr 32px;
    align-items: center;
    gap: 10px;
  }

  .bar-label {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    background: var(--bg-elevated);
    border-radius: 3px;
    height: 8px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .bar-blue   { background: #3b82f6; }
  .bar-green  { background: #22c55e; }
  .bar-purple { background: #a855f7; }

  .bar-count {
    font-size: 12px;
    color: var(--text-muted);
    text-align: right;
  }

  /* Month chart */
  .month-chart {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 160px;
    padding-bottom: 28px;
  }

  .month-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
  }

  .month-count {
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .month-bar-wrap {
    flex: 1;
    display: flex;
    align-items: flex-end;
    width: 100%;
  }

  .month-bar {
    width: 100%;
    background: #4a9eff;
    border-radius: 3px 3px 0 0;
    min-height: 4px;
    transition: height 0.4s ease;
  }

  .month-label {
    font-size: 9px;
    color: var(--text-muted);
    margin-top: 4px;
    transform: rotate(-45deg);
    white-space: nowrap;
    display: block;
  }

  /* Ranked lists */
  .ranked-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ranked-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-elevated);
    border-radius: var(--radius);
  }

  .ranked-item-gold {
    background: rgba(234, 179, 8, 0.08);
  }

  .rank {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(74, 158, 255, 0.2);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .rank-gold {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .ranked-info {
    flex: 1;
    min-width: 0;
  }

  .ranked-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ranked-sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  .ranked-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  .rating-info {
    text-align: right;
  }

  .rating-value {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #eab308;
  }

  .rating-count {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Recent list */
  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg-elevated);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.2s;
  }

  .recent-item:hover {
    background: rgba(74, 158, 255, 0.1);
  }

  .recent-name {
    font-size: 13px;
    font-weight: 500;
  }

  .recent-sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  .recent-date {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    margin-left: 8px;
  }

  .empty-hint {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    padding: 20px 0;
  }

  @media (max-width: 900px) {
    .summary-grid { grid-template-columns: repeat(2, 1fr); }
    .charts-grid  { grid-template-columns: 1fr; }
    .panel-wide   { grid-column: span 1; }
    .bottom-grid  { grid-template-columns: 1fr; }
  }
</style>
