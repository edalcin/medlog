<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { IndicatorSeries, Observation } from '../lib/api'
  import { localDate } from '../lib/date'

  let indicators = $state<IndicatorSeries[]>([])
  let selected = $state('')
  let observations = $state<Observation[]>([])
  let loading = $state(true)
  let loadingSeries = $state(false)
  let error = $state('')
  let search = $state('')

  const visible = $derived(
    search.trim()
      ? indicators.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase()))
      : indicators
  )

  const current = $derived(indicators.find(i => i.code === selected) ?? null)

  /** Só o que tem valor numérico entra no gráfico; ">90" não tem lugar num eixo. */
  const points = $derived(observations.filter(o => o.valueNum != null))
  const nonNumeric = $derived(observations.filter(o => o.valueNum == null))

  onMount(async () => {
    try {
      indicators = await api.getSeriesIndex()
      if (indicators.length) await select(indicators[0].code)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar os indicadores'
    } finally {
      loading = false
    }
  })

  async function select(code: string) {
    selected = code
    loadingSeries = true
    try {
      observations = await api.getSeries(code)
      error = ''
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar a série'
      observations = []
    } finally {
      loadingSeries = false
    }
  }

  // Geometria do gráfico. SVG escrito à mão: nenhuma biblioteca de gráficos
  // entra no bundle, que é o compromisso do projeto com o tamanho da imagem.
  const W = 760
  const H = 280
  const PAD = { top: 16, right: 18, bottom: 34, left: 58 }

  type Plot = {
    x: number
    y: number
    o: Observation
  }

  const chart = $derived.by(() => {
    if (points.length === 0) return null

    const times = points.map(p => localDate(p.collectedAt).getTime())
    const values = points.map(p => p.valueNum as number)

    // A faixa desenhada é a da coleta mais recente que traz os dois limites:
    // ponytail: faixa condicional (TSH por idade) muda entre coletas, e uma só
    // banda é honesta o bastante; se algum dia precisar variar, vira polígono.
    const banded = [...points].reverse().find(p => p.refMin != null && p.refMax != null)
    const refMin = banded?.refMin
    const refMax = banded?.refMax

    let lo = Math.min(...values, refMin ?? Infinity)
    let hi = Math.max(...values, refMax ?? -Infinity)
    if (lo === hi) {
      lo -= 1
      hi += 1
    }
    const margin = (hi - lo) * 0.08
    lo -= margin
    hi += margin

    const t0 = Math.min(...times)
    const t1 = Math.max(...times)
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom

    const x = (t: number) => (t1 === t0 ? PAD.left + innerW / 2 : PAD.left + ((t - t0) / (t1 - t0)) * innerW)
    const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

    const plots: Plot[] = points.map((o, i) => ({ x: x(times[i]), y: y(values[i]), o }))
    const line = plots.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

    const band =
      refMin != null && refMax != null
        ? { y: y(refMax), height: Math.max(1, y(refMin) - y(refMax)), min: refMin, max: refMax }
        : null

    const ticks = [hi, (hi + lo) / 2, lo].map(v => ({ v, y: y(v) }))

    return { plots, line, band, ticks, t0, t1, left: PAD.left, right: W - PAD.right, baseline: PAD.top + innerH }
  })

  function fmtDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR')
  }

  function fmtNumber(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }
</script>

<div class="page">
  <header class="page-head">
    <h1>Indicadores</h1>
    <p class="hint">
      Série temporal das Observações confirmadas. Valor ainda em revisão não aparece aqui.
    </p>
  </header>

  {#if loading}
    <p class="state">Carregando...</p>
  {:else if indicators.length === 0}
    <p class="state">
      Nenhuma Observação confirmada ainda. Extraia um laudo em Arquivos e confirme a revisão.
    </p>
  {:else}
    <div class="split">
      <aside class="picker">
        <input class="search" type="search" placeholder="Filtrar indicador" bind:value={search} />
        <ul>
          {#each visible as ind (ind.code)}
            <li>
              <button
                class="pick"
                class:active={ind.code === selected}
                onclick={() => select(ind.code)}
              >
                <span class="pick-name">{ind.name}</span>
                <span class="pick-meta">
                  {ind.count} {ind.count === 1 ? 'medida' : 'medidas'} · até {fmtDate(ind.lastCollectedAt)}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>

      <section class="detail">
        {#if error}
          <p class="error">{error}</p>
        {/if}

        {#if current}
          <h2>
            {current.name}
            {#if current.unit}<span class="unit">({current.unit})</span>{/if}
          </h2>
        {/if}

        {#if loadingSeries}
          <p class="state">Carregando série...</p>
        {:else if chart}
          <svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Série temporal do indicador">
            {#if chart.band}
              <rect
                class="band"
                x={chart.left}
                y={chart.band.y}
                width={chart.right - chart.left}
                height={chart.band.height}
              />
            {/if}

            {#each chart.ticks as tick}
              <line class="grid" x1={chart.left} x2={chart.right} y1={tick.y} y2={tick.y} />
              <text class="tick" x={chart.left - 8} y={tick.y + 4} text-anchor="end">
                {fmtNumber(tick.v)}
              </text>
            {/each}

            <polyline class="line" points={chart.line} />

            {#each chart.plots as p (p.o.id)}
              <circle
                class="point"
                class:evolutive={p.o.provenance === 'evolutive'}
                class:out={p.o.outOfRange === true}
                cx={p.x}
                cy={p.y}
                r="5"
              >
                <title>
                  {fmtDate(p.o.collectedAt)}: {p.o.valueText}{p.o.unit ? ' ' + p.o.unit : ''}{p.o
                    .provenance === 'evolutive'
                    ? ' (laudo evolutivo)'
                    : ''}
                </title>
              </circle>
            {/each}

            <text class="tick" x={chart.left} y={chart.baseline + 20}>
              {fmtDate(new Date(chart.t0).toISOString())}
            </text>
            {#if chart.t1 !== chart.t0}
              <text class="tick" x={chart.right} y={chart.baseline + 20} text-anchor="end">
                {fmtDate(new Date(chart.t1).toISOString())}
              </text>
            {/if}
          </svg>

          <ul class="legend">
            <li><span class="dot"></span> Coleta do laudo</li>
            <li><span class="dot evolutive"></span> Laudo evolutivo</li>
            <li><span class="dot out"></span> Fora da faixa</li>
            {#if chart.band}
              <li>
                <span class="swatch"></span> Faixa de referência
                {fmtNumber(chart.band.min)}–{fmtNumber(chart.band.max)}
              </li>
            {/if}
          </ul>
        {:else}
          <p class="state">
            Nenhum valor numérico neste indicador: os resultados aparecem só na lista abaixo.
          </p>
        {/if}

        {#if nonNumeric.length > 0}
          <div class="block">
            <h3>Resultados não numéricos</h3>
            <p class="hint">
              Valor com qualificador ou texto não entra no gráfico, porque não é ponto de eixo.
            </p>
            <ul class="plain">
              {#each nonNumeric as o (o.id)}
                <li>
                  <span class="date">{fmtDate(o.collectedAt)}</span>
                  <span class="value">{o.valueText}</span>
                  {#if o.provenance === 'evolutive'}<span class="badge">evolutivo</span>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if observations.length > 0}
          <div class="block">
            <h3>Medidas</h3>
            <table>
              <thead>
                <tr>
                  <th>Data de coleta</th>
                  <th>Valor</th>
                  <th>Faixa de referência</th>
                  <th>Procedência</th>
                </tr>
              </thead>
              <tbody>
                {#each [...observations].reverse() as o (o.id)}
                  <tr class:out={o.outOfRange === true}>
                    <td>{fmtDate(o.collectedAt)}</td>
                    <td>
                      {o.valueText}{o.unit ? ' ' + o.unit : ''}
                      {#if o.outOfRange === true}<span class="badge warn">fora da faixa</span>{/if}
                    </td>
                    <td class="muted">{o.referenceText ?? 'não informada'}</td>
                    <td class="muted">{o.provenance === 'evolutive' ? 'laudo evolutivo' : 'laudo'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px;
  }

  .page-head h1 {
    font-size: 20px;
    font-weight: 600;
  }

  .hint {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
  }

  .state {
    margin-top: 20px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .error {
    font-size: 13px;
    color: var(--danger);
    margin-bottom: 12px;
  }

  .split {
    margin-top: 20px;
    display: grid;
    grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .picker {
    position: sticky;
    top: 20px;
  }

  .search {
    width: 100%;
    padding: 7px 10px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .picker ul {
    list-style: none;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pick {
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pick:hover {
    background: var(--bg-surface);
  }

  .pick.active {
    background: var(--bg-surface);
    border-color: var(--accent);
  }

  .pick-name {
    font-size: 13px;
    color: var(--text);
  }

  .pick-meta {
    font-size: 11px;
    color: var(--text-muted);
  }

  .detail h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .unit {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
  }

  .chart {
    width: 100%;
    height: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .band {
    fill: var(--accent);
    opacity: 0.1;
  }

  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }

  .tick {
    fill: var(--text-muted);
    font-size: 11px;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }

  .point {
    fill: var(--accent);
    stroke: var(--bg-surface);
    stroke-width: 2;
  }

  /* Procedência evolutiva não traz método nem faixa própria: ponto vazado. */
  .point.evolutive {
    fill: var(--bg-surface);
    stroke: var(--accent);
  }

  .point.out {
    fill: var(--danger);
  }

  .point.evolutive.out {
    fill: var(--bg-surface);
    stroke: var(--danger);
  }

  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
  }

  .dot.evolutive {
    background: var(--bg-surface);
    border: 2px solid var(--accent);
  }

  .dot.out {
    background: var(--danger);
  }

  .swatch {
    width: 16px;
    height: 10px;
    border-radius: 2px;
    background: var(--accent);
    opacity: 0.25;
  }

  .block {
    margin-top: 28px;
  }

  .block h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .plain {
    list-style: none;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .plain li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .date {
    color: var(--text-muted);
    font-size: 12px;
    min-width: 90px;
  }

  table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 13px;
  }

  th,
  td {
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .muted {
    color: var(--text-muted);
  }

  .badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .badge.warn {
    border-color: var(--danger);
    color: var(--danger);
  }

  @media (max-width: 860px) {
    .split {
      grid-template-columns: 1fr;
    }

    .picker {
      position: static;
    }

    .picker ul {
      max-height: 220px;
    }
  }
</style>
