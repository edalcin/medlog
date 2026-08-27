<script lang="ts">
  import { onMount } from 'svelte'
  // Gráfico em Chart.js, importado como módulo e empacotado pelo Vite —
  // nunca por CDN. Decisão registrada na ADR 0012: o SVG desenhado à mão
  // (uma geração atrás desta tela) foi trocado por uma biblioteca porque
  // o eixo linear com banda de referência e clique-para-abrir-o-laudo
  // não valiam mais a manutenção do cálculo de geometria manual.
  import { link } from '@keenmate/svelte-spa-router'
  import Chart from 'chart.js/auto'
  import type { ChartDataset } from 'chart.js'
  import * as api from '../lib/api'
  import type { IndicatorSeries, NormalRangeResolution, Observation } from '../lib/api'
  import { localDate } from '../lib/date'
  import { currentUser } from '../lib/auth'

  let indicators = $state<IndicatorSeries[]>([])
  let selected = $state('')
  let observations = $state<Observation[]>([])
  let normalRange = $state<NormalRangeResolution | null>(null)
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
  const hasChart = $derived(points.length > 0)

  /** Sem sexo biológico ou data de nascimento não dá pra resolver a Faixa de
   * normalidade por sexo/idade (ADR 0014/0015) — aviso discreto, não bloqueia
   * a tela, só aponta pro perfil. */
  const profileIncomplete = $derived(
    $currentUser != null && ($currentUser.biologicalSex == null || $currentUser.birthDate == null)
  )

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
      const payload = await api.getSeries(code)
      observations = payload.observations
      normalRange = payload.normalRange
      error = ''
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar a série'
      observations = []
      normalRange = null
    } finally {
      loadingSeries = false
    }
  }

  function fmtDate(iso: string): string {
    return localDate(iso).toLocaleDateString('pt-BR')
  }

  /** Diz em uma frase a quem a faixa se aplica. Nulo em sexo ou idade
   * significa "qualquer", e o texto reflete isso em vez de omitir. */
  function describeCandidate(c: api.NormalRange): string {
    const who = c.sex === 'M' ? 'homens' : c.sex === 'F' ? 'mulheres' : 'qualquer sexo'
    let age = 'qualquer idade'
    if (c.ageMin != null && c.ageMax != null) age = `${c.ageMin} a ${c.ageMax} anos`
    else if (c.ageMin != null) age = `${c.ageMin} anos ou mais`
    else if (c.ageMax != null) age = `até ${c.ageMax} anos`
    return `${who}, ${age}`
  }

  /** Os limites da Faixa de normalidade em número, que é o que se procura na
   * tela. O `text` da faixa costuma ser descrição ("população adulta
   * brasileira saudável"), não o intervalo, então mostrar só ele esconderia
   * justamente o dado. Faixa de um lado só vira "acima de" ou "até"; faixa
   * sem limite nenhum devolve null e aí o texto fala por si. */
  function formatBand(c: api.NormalRange): string | null {
    const unit = current?.unit ? ' ' + current.unit : ''
    if (c.min != null && c.max != null) return `${fmtNumber(c.min)} a ${fmtNumber(c.max)}${unit}`
    if (c.min != null) return `acima de ${fmtNumber(c.min)}${unit}`
    if (c.max != null) return `até ${fmtNumber(c.max)}${unit}`
    return null
  }

  function fmtNumber(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }

  /** Faixa de referência desenhada no gráfico: hoje ainda é refMin/refMax da
   * coleta mais recente que traz os dois limites.
   * ponytail: faixa condicional (ex.: TSH por idade) muda entre coletas, e
   * uma só banda é honesta o bastante; se algum dia precisar variar, vira
   * polígono.
   * Isolada nesta função de propósito — a ADR 0015 troca essa fonte pela
   * tabela indicator_normal_ranges (sexo/idade do usuário) numa etapa futura
   * que depende de revisão humana. Quando isso acontecer, só esta função
   * muda; o resto do gráfico não sabe de onde a banda vem. */
  function pickReferenceBand(pts: Observation[]): { min: number; max: number } | null {
    const banded = [...pts].reverse().find(o => o.refMin != null && o.refMax != null)
    return banded && banded.refMin != null && banded.refMax != null
      ? { min: banded.refMin, max: banded.refMax }
      : null
  }

  const bandInfo = $derived(hasChart ? pickReferenceBand(points) : null)

  function hexToRgba(hex: string, alpha: number): string {
    const m = hex.trim().match(/^#([0-9a-f]{6})$/i)
    if (!m) return hex
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }

  /** Cores do gráfico saem sempre das variáveis do tema atual (app.css,
   * data-theme), nunca de valor fixo — senão o tema claro fica ilegível.
   * ponytail: lida uma vez na criação do gráfico, não escuta troca de tema
   * em tempo real; trocar de indicador (ou recarregar) já repinta com o
   * tema novo. Upgrade se precisar de hot-swap: observar mudança do
   * atributo data-theme em document.documentElement aqui. */
  function themeColors() {
    const cs = getComputedStyle(document.documentElement)
    const v = (name: string) => cs.getPropertyValue(name).trim()
    return {
      accent: v('--accent'),
      bgSurface: v('--bg-surface'),
      border: v('--border'),
      textMuted: v('--text-muted'),
      danger: v('--danger'),
    }
  }

  /** Abre o Laudo de origem na mesma aba/rota que Files.svelte e
   * ExtractionReview.svelte usam para o link "Abrir o documento". Sem
   * sourceFilename (Observação lançada à mão, sem laudo) o clique não faz
   * nada. */
  function openSource(o: Observation) {
    if (!o.sourceFilename) return
    window.open(`/api/files/${o.sourceFilename}`, '_blank', 'noopener')
  }

  type Point = { x: number; y: number }

  function buildChart(canvas: HTMLCanvasElement, pts: Observation[]) {
    const colors = themeColors()
    const times = pts.map(o => localDate(o.collectedAt).getTime())
    const t0 = Math.min(...times)
    const t1 = Math.max(...times)

    const datasets: ChartDataset<'line', Point[]>[] = []

    const band = pickReferenceBand(pts)
    if (band) {
      // Banda de referência: ver pickReferenceBand() acima — é o único lugar
      // que muda quando a ADR 0015 chegar. Duas linhas horizontais sem ponto
      // nem traço, com preenchimento entre elas.
      datasets.push(
        {
          label: 'Faixa de referência (máx)',
          data: [{ x: t0, y: band.max }, { x: t1, y: band.max }],
          borderWidth: 0,
          pointRadius: 0,
          fill: '+1',
          backgroundColor: hexToRgba(colors.accent, 0.14),
          order: 2,
        },
        {
          label: 'Faixa de referência (mín)',
          data: [{ x: t0, y: band.min }, { x: t1, y: band.min }],
          borderWidth: 0,
          pointRadius: 0,
          fill: false,
          order: 2,
        },
      )
    }

    // Procedência no ponto: evolutivo fica vazado (preenchimento = cor do
    // fundo, contorno = cor da linha); fora da faixa muda a cor, não a forma.
    datasets.push({
      label: current?.name ?? 'Valor',
      data: pts.map((o, i) => ({ x: times[i], y: o.valueNum as number })),
      borderColor: colors.accent,
      backgroundColor: colors.accent,
      borderWidth: 2,
      tension: 0,
      pointRadius: 5,
      pointHoverRadius: 6,
      pointBackgroundColor: pts.map(o =>
        o.provenance === 'evolutive' ? colors.bgSurface : o.outOfRange ? colors.danger : colors.accent
      ),
      pointBorderColor: pts.map(o =>
        o.provenance === 'evolutive' ? (o.outOfRange ? colors.danger : colors.accent) : colors.bgSurface
      ),
      pointBorderWidth: 2,
      order: 1,
    })
    const mainIndex = datasets.length - 1

    return new Chart<'line', Point[]>(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: true },
        scales: {
          x: {
            type: 'linear',
            grid: { color: colors.border },
            ticks: {
              color: colors.textMuted,
              maxTicksLimit: 6,
              callback: value => fmtDate(new Date(Number(value)).toISOString()),
            },
          },
          y: {
            grace: '8%',
            grid: { color: colors.border },
            ticks: {
              color: colors.textMuted,
              callback: value => fmtNumber(Number(value)),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: item => item.datasetIndex === mainIndex,
            callbacks: {
              title: items => (items[0] ? fmtDate(pts[items[0].dataIndex].collectedAt) : ''),
              label: item => {
                const o = pts[item.dataIndex]
                // Unidade impressa no laudo quando existe; a canônica do catálogo
                // (ADR 0007) cobre a Observação que veio sem ela.
                const unit = o.unit ?? current?.unit
                const value = `${o.valueText}${unit ? ' ' + unit : ''}`
                const provenance = o.provenance === 'evolutive' ? 'laudo evolutivo' : 'laudo'
                return `${value} — ${provenance}`
              },
            },
          },
        },
        onClick: (_event, elements) => {
          const el = elements.find(e => e.datasetIndex === mainIndex)
          if (el) openSource(pts[el.index])
        },
        onHover: (event, elements) => {
          const el = elements.find(e => e.datasetIndex === mainIndex)
          const clickable = el != null && pts[el.index]?.sourceFilename != null
          const target = event.native?.target as HTMLElement | null
          if (target) target.style.cursor = clickable ? 'pointer' : 'default'
        },
      },
    })
  }

  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined)

  // Uma instância de Chart por gráfico: troca de indicador ou desmonte do
  // componente sempre destrói a anterior antes de criar a próxima, senão
  // vaza canvas a cada seleção.
  $effect(() => {
    const pts = points
    if (!canvasEl || pts.length === 0) return
    const instance = buildChart(canvasEl, pts)
    return () => instance.destroy()
  })
</script>

<div class="page">
  <header class="page-head">
    <h1>Indicadores</h1>
    <p class="hint">
      Série temporal das Observações confirmadas. Valor ainda em revisão não aparece aqui.
    </p>
  </header>

  {#if profileIncomplete}
    <div class="notice notice-info">
      Faixas de normalidade por sexo e idade só aparecem depois de informar sexo biológico e data
      de nascimento no <a href="/config" use:link>seu perfil</a>.
    </div>
  {/if}

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
        {:else if hasChart}
          <div class="chart-wrap">
            <canvas bind:this={canvasEl} aria-label="Série temporal do indicador"></canvas>
          </div>

          <ul class="legend">
            <li><span class="dot"></span> Coleta do laudo</li>
            <li><span class="dot evolutive"></span> Laudo evolutivo</li>
            <li><span class="dot out"></span> Fora da faixa</li>
            {#if bandInfo}
              <li>
                <span class="swatch"></span> Faixa de referência
                {fmtNumber(bandInfo.min)}–{fmtNumber(bandInfo.max)}
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

        <!-- Faixa de normalidade (ADR 0015): conceito distinto da Faixa de
             referência impressa no Laudo, que segue na coluna da tabela
             abaixo até a migração 009 semear os dados clínicos revisados. -->
        <div class="block">
          <h3>Faixa de normalidade</h3>
          {#if !normalRange || normalRange.candidates.length === 0}
            <p class="hint">
              Faixa de normalidade não cadastrada para este indicador.
            </p>
          {:else if normalRange.resolved}
            {@const c = normalRange.candidates[0]}
            {@const band = formatBand(c)}
            <p class="range">
              {#if band}<strong>{band}</strong>{' — '}{/if}{c.text}
              <span class="muted">
                ({describeCandidate(c)}, fonte: {c.source})
              </span>
            </p>
          {:else}
            <p class="hint">
              Há mais de uma faixa possível para este indicador e o seu perfil não permite escolher
              entre elas. Complete sexo biológico e data de nascimento em
              <a href="/config" use:link>Configurações</a> para ver a que se aplica a você. Até então o
              gráfico não desenha a banda.
            </p>
            <ul class="plain">
              {#each normalRange.candidates as c (`${c.sex}|${c.ageMin}|${c.ageMax}`)}
                <li>
                  <span class="value">{formatBand(c) ?? c.text}</span>
                  <span class="muted">— {describeCandidate(c)}, fonte: {c.source}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

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
                      {#if o.outOfRange === true}<span class="badge warn">fora da faixa do laboratório</span>{/if}
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

  .chart-wrap {
    position: relative;
    width: 100%;
    height: 320px;
    padding: 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-sizing: border-box;
  }

  .notice {
    border: 1px solid var(--border);
    border-left-width: 3px;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-top: 16px;
    font-size: 13px;
    line-height: 1.6;
  }

  .notice-info {
    border-left-color: var(--text-muted);
    background: var(--bg-surface);
    color: var(--text-muted);
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

  .range {
    margin-top: 8px;
    font-size: 13px;
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
