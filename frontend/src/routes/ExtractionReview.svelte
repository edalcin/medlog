<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { ExtractionReview, Observation } from '../lib/api'
  import { localDate } from '../lib/date'

  let { params } = $props<{ params: Record<string, string> }>()

  let review = $state<ExtractionReview | null>(null)
  let loading = $state(true)
  let error = $state('')

  let acting = $state(false)
  let actionError = $state('')
  let confirmResult = $state<{ confirmed: number; metadataApplied: string[] } | null>(null)
  let rejectResult = $state<{ rejected: number } | null>(null)

  // Promoção de analitos ao catálogo — um formulário por pendência, indexado pela posição.
  let promoteCode = $state<Record<number, string>>({})
  let promoteName = $state<Record<number, string>>({})
  let promoteUnit = $state<Record<number, string>>({})
  let promoteError = $state<Record<number, string>>({})
  let promoted = $state<Record<number, string>>({})
  let promotingIndex = $state<number | null>(null)

  // A extração roda em goroutine e demora minutos: o estado só chega por polling,
  // porque o fetch do projeto aborta em 30s.
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollError = $state('')

  const extraction = $derived(review?.extraction ?? null)
  const observations = $derived(review?.observations ?? [])
  const pending = $derived(extraction?.status === 'pending')
  const failed = $derived(extraction?.status === 'failed')
  // Só uma extração ainda em revisão pode ser confirmada ou rejeitada, e nunca vazia.
  const decided = $derived(confirmResult !== null || rejectResult !== null)
  const canDecide = $derived(
    extraction?.status === 'succeeded' && observations.length > 0 && !decided
  )

  /** Observações agrupadas por data de coleta, mais recente primeiro. */
  const groups = $derived.by(() => {
    const map = new Map<string, Observation[]>()
    for (const o of observations) {
      const key = o.collectedAt.substring(0, 10)
      const bucket = map.get(key)
      if (bucket) bucket.push(o)
      else map.set(key, [o])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })

  /** Campos de metadado que não têm nada a dizer são omitidos. */
  const metadata = $derived((review?.metadata ?? []).filter(m => m.suggested || m.current))

  const hasEvolutive = $derived(observations.some(o => o.provenance === 'evolutive'))

  onMount(load)
  onDestroy(stopPolling)

  async function load() {
    try {
      review = await api.getExtractionReview(params.id)
      error = ''
      resetPromoteForms()
      if (review.extraction.status === 'pending') startPolling()
      else stopPolling()
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar a revisão'
    } finally {
      loading = false
    }
  }

  function resetPromoteForms() {
    if (!review) return
    review.unmapped.forEach((u, i) => {
      if (promoted[i]) return
      promoteCode[i] = toSnakeCase(u.label)
      promoteName[i] = u.label
      promoteUnit[i] = u.unit ?? ''
    })
  }

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(async () => {
      try {
        const current = await api.getExtraction(params.id)
        pollError = ''
        if (current.status !== 'pending') {
          stopPolling()
          await load()
        } else if (review) {
          review.extraction = current
        }
      } catch (e: unknown) {
        pollError = e instanceof Error ? e.message : 'Falha ao consultar o andamento'
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /** Sugestão de código a partir do rótulo impresso no laudo. O ADMIN pode editar. */
  function toSnakeCase(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatCollected(key: string): string {
    return localDate(key).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  async function confirmAll() {
    if (!review) return
    const total = observations.length
    if (
      !confirm(
        `Confirmar a extração inteira? ${total} ${total === 1 ? 'Observação passa' : 'Observações passam'} a valer, e os metadados sugeridos são gravados nos campos ainda vazios.`
      )
    )
      return
    acting = true
    actionError = ''
    try {
      confirmResult = await api.confirmExtraction(review.extraction.id)
      review = await api.getExtractionReview(params.id)
    } catch (e: unknown) {
      actionError = e instanceof Error ? e.message : 'Erro ao confirmar a extração'
    } finally {
      acting = false
    }
  }

  async function rejectAll() {
    if (!review) return
    if (!confirm('Rejeitar a extração inteira? Nenhuma Observação passa a valer.')) return
    acting = true
    actionError = ''
    try {
      rejectResult = await api.rejectExtraction(review.extraction.id)
      review = await api.getExtractionReview(params.id)
    } catch (e: unknown) {
      actionError = e instanceof Error ? e.message : 'Erro ao rejeitar a extração'
    } finally {
      acting = false
    }
  }

  async function promote(index: number) {
    const code = (promoteCode[index] ?? '').trim()
    const name = (promoteName[index] ?? '').trim()
    if (!code || !name) {
      promoteError[index] = 'Informe código e nome.'
      return
    }
    promotingIndex = index
    promoteError[index] = ''
    try {
      const indicator = await api.promoteHealthIndicator(code, name, promoteUnit[index] || undefined)
      promoted[index] = indicator.code
    } catch (e: unknown) {
      promoteError[index] = e instanceof Error ? e.message : 'Erro ao promover o analito'
    } finally {
      promotingIndex = null
    }
  }
</script>

<div class="page review-page">
  {#if loading}
    <div class="loading">Carregando revisão...</div>
  {:else if error}
    <div class="page-header">
      <button class="btn btn-ghost btn-back" onclick={() => push('/files')}>← Voltar</button>
    </div>
    <p class="error-msg">{error}</p>
    <button class="btn btn-secondary" onclick={load}>Tentar novamente</button>
  {:else if review && extraction}
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-back" onclick={() => push('/files')}>← Voltar</button>
        <h1>Revisão da extração</h1>
        <p class="file-name">{review.file.customName || review.file.filename}</p>
      </div>
      <span
        class="badge {failed
          ? 'badge-red'
          : pending
            ? 'badge-yellow'
            : confirmResult
              ? 'badge-green'
              : rejectResult
                ? 'badge-red'
                : 'badge-blue'}"
      >
        {failed
          ? 'Falhou'
          : pending
            ? 'Em andamento'
            : confirmResult
              ? 'Confirmada'
              : rejectResult
                ? 'Rejeitada'
                : observations.length > 0
                  ? 'Aguardando revisão'
                  : 'Sem observações em revisão'}
      </span>
    </div>

    <dl class="run-meta">
      <div>
        <dt>Modelo</dt>
        <dd>{extraction.model}</dd>
      </div>
      <div>
        <dt>Tokens de entrada</dt>
        <dd>{extraction.inputTokens?.toLocaleString('pt-BR') ?? '—'}</dd>
      </div>
      <div>
        <dt>Tokens de saída</dt>
        <dd>{extraction.outputTokens?.toLocaleString('pt-BR') ?? '—'}</dd>
      </div>
      <div>
        <dt>Extraído em</dt>
        <dd>{formatDateTime(extraction.finishedAt ?? extraction.createdAt)}</dd>
      </div>
      <div>
        <dt>Observações</dt>
        <dd>{observations.length}</dd>
      </div>
    </dl>

    {#if pending}
      <div class="notice notice-running">
        <strong>Extração em andamento.</strong>
        A leitura do laudo pelo modelo leva alguns minutos. Esta tela consulta o andamento a cada 3
        segundos e recarrega sozinha quando terminar — pode deixá-la aberta.
        {#if pollError}
          <span class="poll-error">{pollError} Nova tentativa em 3 segundos.</span>
        {/if}
      </div>
    {:else if failed}
      <div class="notice notice-failed">
        <strong>A extração falhou.</strong>
        Nada foi gravado e não há o que revisar. A extração continua registrada para auditoria.
        {#if extraction.error}
          <pre class="fail-detail">{extraction.error}</pre>
        {/if}
      </div>
    {/if}

    {#if confirmResult}
      <div class="notice notice-done">
        <strong
          >{confirmResult.confirmed}
          {confirmResult.confirmed === 1 ? 'Observação passou' : 'Observações passaram'} a valer.</strong
        >
        {#if confirmResult.metadataApplied.length > 0}
          Metadados gravados no documento: {confirmResult.metadataApplied.join(', ')}.
        {:else}
          Nenhum metadado do documento foi alterado.
        {/if}
      </div>
    {/if}

    {#if rejectResult}
      <div class="notice notice-rejected">
        <strong
          >{rejectResult.rejected}
          {rejectResult.rejected === 1 ? 'Observação rejeitada' : 'Observações rejeitadas'}.</strong
        >
        Nenhuma passou a valer. A extração segue registrada e auditável, e o documento pode ser
        reinterpretado numa nova extração.
      </div>
    {/if}

    {#if actionError}
      <p class="error-msg">{actionError}</p>
    {/if}

    <div class="split">
      <section class="doc-pane" aria-label="Documento de origem">
        <iframe class="doc-frame" src="/api/files/{review.file.filename}" title="Documento original"
        ></iframe>
        <a class="doc-link" href="/api/files/{review.file.filename}" target="_blank" rel="noopener">
          Abrir o documento em outra aba
        </a>
      </section>

      <div class="review-pane">
        {#if metadata.length > 0}
          <section class="block">
            <h2>Metadados do documento</h2>
            <p class="block-hint">
              O que o modelo leu no laudo, comparado ao que já está gravado no documento.
            </p>
            <ul class="meta-list">
              {#each metadata as m (m.field)}
                <li class="meta-item" class:divergent={m.divergent}>
                  <div class="meta-head">
                    <span class="meta-label">{m.label}</span>
                    {#if m.divergent}
                      <span class="badge badge-yellow">divergente</span>
                    {:else if m.willBeSet}
                      <span class="badge badge-green">será preenchido</span>
                    {/if}
                  </div>
                  <div class="meta-values">
                    <span class="meta-slot">
                      <span class="slot-label">Sugerido pela IA</span>
                      <span class="slot-value">{m.suggested || '—'}</span>
                    </span>
                    <span class="meta-slot">
                      <span class="slot-label">Valor atual</span>
                      <span class="slot-value">{m.current || '(vazio)'}</span>
                    </span>
                  </div>
                  {#if m.divergent}
                    <p class="meta-note">
                      Um humano já preencheu este campo com um valor diferente. O valor humano
                      prevalece: confirmar a extração <strong>não</strong> sobrescreve o que está
                      gravado.
                    </p>
                  {:else if m.willBeSet}
                    <p class="meta-note">
                      O campo está vazio e será preenchido com a sugestão ao confirmar a extração.
                    </p>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <section class="block">
          <h2>Observações ({observations.length})</h2>
          {#if observations.length === 0}
            <p class="empty-small">
              {pending
                ? 'Nada extraído ainda — aguardando o modelo terminar.'
                : 'Esta extração não produziu nenhuma Observação.'}
            </p>
          {:else}
            <p class="block-hint">
              Nenhuma destas Observações vale nada ainda: só passam a valer, e só entram em série
              histórica, depois da confirmação em bloco no rodapé.
            </p>
            {#each groups as [date, items] (date)}
              <div class="obs-group">
                <h3 class="obs-date">
                  {formatCollected(date)}
                  <span class="obs-count">{items.length}</span>
                </h3>
                <ul class="obs-list">
                  {#each items as o (o.id)}
                    <li class="obs" class:evolutive={o.provenance === 'evolutive'}>
                      <div class="obs-main">
                        <span class="obs-name">{o.indicatorName}</span>
                        <span class="obs-value" class:non-numeric={o.valueNum === undefined}>
                          {o.valueText}
                          {#if o.unit}<span class="obs-unit">{o.unit}</span>{/if}
                        </span>
                      </div>
                      <div class="obs-tags">
                        {#if o.valueNum === undefined}
                          <span class="tag tag-nonnum">não numérico</span>
                        {/if}
                        {#if o.outOfRange === true}
                          <span class="tag tag-out">fora da faixa</span>
                        {:else if o.outOfRange === false}
                          <span class="tag tag-in">dentro da faixa</span>
                        {:else}
                          <span class="tag tag-unknown" title="O laudo não traz marcador de alteração para este resultado. Não significa que a faixa de referência esteja ausente.">sem marcador</span>
                        {/if}
                        {#if o.provenance === 'evolutive'}
                          <span class="tag tag-evolutive">tabela evolutiva</span>
                        {/if}
                        <span class="obs-code">{o.indicatorCode}</span>
                      </div>
                      {#if o.referenceText}
                        <p class="obs-ref">Referência: {o.referenceText}</p>
                      {:else if o.provenance === 'primary'}
                        <p class="obs-ref obs-ref-none">Faixa de referência não impressa no laudo.</p>
                      {/if}
                      {#if o.valueNum === undefined}
                        <p class="obs-note">
                          Resultado textual, sem valor numérico: fica registrado como texto e não
                          entra em nenhuma série ou gráfico.
                        </p>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
            {#if hasEvolutive}
              <p class="legend">
                <span class="legend-swatch"></span>
                As linhas marcadas assim vêm da <strong>tabela evolutiva</strong> no fim do laudo:
                trazem só valor e data, sem método de análise e sem faixa de referência própria.
              </p>
            {/if}
          {/if}
        </section>

        {#if review.unmapped.length > 0}
          <section class="block">
            <h2>Pendências do catálogo ({review.unmapped.length})</h2>
            <p class="block-hint">
              Analitos que o laudo traz e o catálogo de Indicadores não tem. Não viram Indicador
              sozinhos. Promover um analito <strong>não reprocessa este laudo</strong>: os valores
              acima continuam de fora, e capturá-los exige uma nova extração do documento.
            </p>
            <ul class="pend-list">
              {#each review.unmapped as u, i (u.label + u.collectedAt)}
                <li class="pend">
                  <div class="pend-head">
                    <span class="pend-label">{u.label}</span>
                    <span class="pend-value">
                      {u.valueText}
                      {#if u.unit}<span class="obs-unit">{u.unit}</span>{/if}
                    </span>
                    <span class="pend-date">{formatCollected(u.collectedAt)}</span>
                  </div>
                  {#if u.referenceText}
                    <p class="obs-ref">Referência: {u.referenceText}</p>
                  {/if}
                  {#if promoted[i]}
                    <p class="pend-ok">
                      Promovido ao catálogo como <code>{promoted[i]}</code>. Rode uma nova extração
                      deste documento para capturar o valor.
                    </p>
                  {:else}
                    <div class="pend-form">
                      <div class="form-group">
                        <label for="pcode-{i}">Código</label>
                        <input id="pcode-{i}" type="text" bind:value={promoteCode[i]} />
                      </div>
                      <div class="form-group">
                        <label for="pname-{i}">Nome</label>
                        <input id="pname-{i}" type="text" bind:value={promoteName[i]} />
                      </div>
                      <div class="form-group">
                        <label for="punit-{i}">Unidade</label>
                        <input id="punit-{i}" type="text" bind:value={promoteUnit[i]} />
                      </div>
                      <button
                        class="btn btn-secondary"
                        onclick={() => promote(i)}
                        disabled={promotingIndex === i}
                      >
                        {promotingIndex === i ? 'Promovendo...' : 'Promover'}
                      </button>
                    </div>
                    {#if promoteError[i]}
                      <p class="error-msg">{promoteError[i]}</p>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    </div>

    {#if !pending && !failed && !decided}
      <div class="action-bar">
        <p class="action-hint">
          {observations.length === 0
            ? 'Sem Observações para revisar.'
            : `A decisão vale para a extração inteira: ${observations.length} ${observations.length === 1 ? 'Observação' : 'Observações'}, nunca item por item.`}
        </p>
        <div class="action-buttons">
          <button class="btn btn-ghost" onclick={rejectAll} disabled={!canDecide || acting}>
            {acting ? 'Aguarde...' : 'Rejeitar tudo'}
          </button>
          <button class="btn btn-primary" onclick={confirmAll} disabled={!canDecide || acting}>
            {acting ? 'Aguarde...' : 'Confirmar tudo'}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .review-page {
    max-width: 1440px;
  }

  .btn-back {
    font-size: 13px;
    padding: 4px 10px;
    margin-bottom: 8px;
    display: inline-block;
  }

  .file-name {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .run-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 32px;
    padding: 14px 18px;
    margin-bottom: 20px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .run-meta dt {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .run-meta dd {
    font-size: 14px;
    margin-top: 2px;
  }

  .notice {
    border: 1px solid var(--border);
    border-left-width: 3px;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 13px;
    line-height: 1.6;
  }

  .notice-running {
    border-left-color: var(--warning);
    background: rgba(243, 156, 18, 0.08);
  }

  .notice-failed {
    border-left-color: var(--danger);
    background: rgba(231, 76, 60, 0.08);
  }

  .notice-done {
    border-left-color: var(--success);
    background: rgba(39, 174, 96, 0.08);
  }

  .notice-rejected {
    border-left-color: var(--text-muted);
    background: var(--bg-surface);
  }

  .poll-error {
    display: block;
    margin-top: 6px;
    color: var(--danger);
  }

  .fail-detail {
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--bg);
    border-radius: var(--radius);
    font-size: 12px;
    white-space: pre-wrap;
    overflow-x: auto;
  }

  .split {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 24px;
    align-items: start;
  }

  .doc-pane {
    position: sticky;
    top: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .doc-frame {
    width: 100%;
    height: calc(100vh - 160px);
    min-height: 420px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-surface);
  }

  .doc-link {
    font-size: 12px;
    color: var(--text-muted);
  }

  .review-pane {
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding-bottom: 24px;
  }

  .block h2 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .block-hint {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
    margin-bottom: 14px;
  }

  /* Metadados */
  .meta-list,
  .obs-list,
  .pend-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .meta-item {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
  }

  .meta-item.divergent {
    border-left: 3px solid var(--warning);
  }

  .meta-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .meta-label {
    font-size: 13px;
    font-weight: 600;
  }

  .meta-values {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
  }

  .meta-slot {
    display: flex;
    flex-direction: column;
  }

  .slot-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .slot-value {
    font-size: 13px;
  }

  .meta-note {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  /* Observações */
  .obs-group + .obs-group {
    margin-top: 20px;
  }

  .obs-date {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding-bottom: 6px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .obs-count {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .obs {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    padding: 10px 14px;
  }

  /* Proveniência evolutiva: valor e data apenas, sem método nem faixa própria. */
  .obs.evolutive {
    background: var(--bg-elevated);
    border-left-style: dashed;
    border-left-color: var(--text-muted);
  }

  .obs-main {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .obs-name {
    font-size: 14px;
    font-weight: 500;
  }

  .obs-value {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Sem valorNum: resultado textual, nunca comparável nem plotável. */
  .obs-value.non-numeric {
    font-weight: 400;
    font-style: italic;
    font-variant-numeric: normal;
    border-bottom: 1px dashed var(--text-muted);
  }

  .obs-unit {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 4px;
  }

  .obs-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .tag {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 10px;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .tag-out {
    background: rgba(231, 76, 60, 0.15);
    color: var(--danger);
    border-color: var(--danger);
    font-weight: 600;
  }

  .tag-in {
    background: rgba(39, 174, 96, 0.15);
    color: var(--success);
  }

  /* Ausência de marcador não é "dentro da faixa": neutro, tracejado, nunca verde. */
  .tag-unknown {
    background: transparent;
    color: var(--text-muted);
    border: 1px dashed var(--border);
  }

  .tag-nonnum {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    font-style: italic;
  }

  .tag-evolutive {
    background: transparent;
    color: var(--text-muted);
    border: 1px dashed var(--text-muted);
  }

  .obs-code {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
  }

  .obs-ref,
  .obs-note {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .obs-ref-none {
    font-style: italic;
  }

  .legend {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 16px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-muted);
  }

  .legend-swatch {
    flex: none;
    width: 3px;
    height: 32px;
    margin-top: 2px;
    border-left: 3px dashed var(--text-muted);
  }

  /* Pendências */
  .pend {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
  }

  .pend-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .pend-label {
    font-size: 14px;
    font-weight: 500;
  }

  .pend-value {
    font-size: 14px;
    font-weight: 600;
  }

  .pend-date {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
  }

  .pend-form {
    display: grid;
    grid-template-columns: 1fr 1fr 90px auto;
    align-items: end;
    gap: 10px;
    margin-top: 10px;
  }

  .pend-form .form-group {
    margin-bottom: 0;
  }

  .pend-ok {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--success);
  }

  .pend-ok code {
    font-size: 12px;
  }

  .empty-small {
    color: var(--text-muted);
    font-size: 13px;
  }

  /* Rodapé de decisão em bloco */
  .action-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 8px;
    padding: 14px 18px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .action-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .action-buttons {
    display: flex;
    gap: 10px;
    margin-left: auto;
  }

  @media (max-width: 1024px) {
    .split {
      grid-template-columns: minmax(0, 1fr);
    }

    .doc-pane {
      position: static;
    }

    .doc-frame {
      height: 60vh;
    }

    .pend-form {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
