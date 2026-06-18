<script lang="ts">
  let {
    value = $bindable<number | undefined>(undefined),
    readonly = false,
    size,
  }: {
    value?: number
    readonly?: boolean
    size?: number
  } = $props()

  // SVG-based: each star is an inline SVG with fixed pixel dimensions,
  // immune to font metric differences that caused uneven spacing with ★/☆.
  // 5-pointed star, viewBox 0 0 24 24, center (12,12), outer r=10, inner r=4.
  const STAR = 'M12 2 L14.4 8.8 L21.5 8.9 L15.8 13.2 L17.9 20.1 L12 16 L6.1 20.1 L8.2 13.2 L2.5 8.9 L9.6 8.8Z'

  const TOTAL = 5

  // Defaults: interactive stars a little larger than readonly ones.
  const sz   = size ?? (readonly ? 14 : 18)
  // Interactive button padding so stars have breathing room without being 40px blocks.
  const pad  = Math.max(4, Math.round(sz * 0.3))

  let hovered = $state<number | undefined>(undefined)

  function filled(i: number): boolean {
    if (readonly) return i <= Math.round(value ?? 0)
    return i <= (hovered ?? value ?? 0)
  }

  function click(i: number) {
    value = value === i ? undefined : i
    hovered = undefined
  }
</script>

{#if readonly}
  <span
    class="stars ro"
    style="--sz:{sz}px"
    aria-label={value != null ? `${Math.round(value)} de ${TOTAL} estrelas` : 'sem avaliação'}
  >
    {#if value != null}
      {#each { length: TOTAL } as _, idx}
        <svg width={sz} height={sz} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR} fill={filled(idx + 1) ? 'var(--warning)' : 'var(--border)'} />
        </svg>
      {/each}
    {:else}
      <span class="dash">—</span>
    {/if}
  </span>
{:else}
  <span class="stars ia" style="--sz:{sz}px;--pad:{pad}px" role="group" aria-label="Avaliação com estrelas">
    {#each { length: TOTAL } as _, idx}
      {@const i = idx + 1}
      <button
        type="button"
        class="stn"
        onclick={() => click(i)}
        onmouseenter={() => (hovered = i)}
        onmouseleave={() => (hovered = undefined)}
        aria-label="{i} estrela{i > 1 ? 's' : ''}"
        aria-pressed={value === i}
      >
        <svg width={sz} height={sz} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR} fill={filled(i) ? 'var(--warning)' : 'var(--border)'} />
        </svg>
      </button>
    {/each}
    {#if value != null}
      <button
        type="button"
        class="clr"
        onclick={() => { value = undefined; hovered = undefined }}
        onmouseenter={() => (hovered = undefined)}
        aria-label="Limpar avaliação"
      >✕</button>
    {/if}
  </span>
{/if}

<style>
  .stars {
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }

  /* Readonly: fixed 2px gap; SVG width is exact so spacing is always even. */
  .stars.ro {
    gap: 2px;
  }

  /* Interactive: no gap — padding on each button provides the spacing. */
  .stars.ia {
    gap: 0;
  }

  .stn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--pad);
    background: none;
    border: none;
    cursor: pointer;
    border-radius: var(--radius);
    line-height: 0;
    transition: transform 0.1s;
    flex-shrink: 0;
  }

  .stn:hover {
    transform: scale(1.2);
  }

  .stn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .clr {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 10px;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.12s;
    flex-shrink: 0;
  }

  .clr:hover {
    color: var(--text);
  }

  .dash {
    font-size: 14px;
    color: var(--text-muted);
  }
</style>
