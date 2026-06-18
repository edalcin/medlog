<script lang="ts">
  let {
    value = $bindable<number | undefined>(undefined),
    readonly = false
  } = $props()

  let hovered = $state<number | undefined>(undefined)

  const TOTAL = 5

  function isFilled(index: number): boolean {
    if (readonly) {
      const display = value !== undefined ? Math.round(value) : 0
      return index <= display
    }
    const preview = hovered ?? value ?? 0
    return index <= preview
  }

  function handleClick(index: number) {
    if (readonly) return
    value = value === index ? undefined : index
    hovered = undefined
  }

  function handleMouseEnter(index: number) {
    if (readonly) return
    hovered = index
  }

  function handleMouseLeave() {
    if (readonly) return
    hovered = undefined
  }

  function clearValue() {
    if (readonly) return
    value = undefined
    hovered = undefined
  }
</script>

{#if readonly}
  <span class="star-rating readonly" aria-label={value !== undefined ? `${Math.round(value)} de ${TOTAL} estrelas` : 'sem avaliação'}>
    {#if value !== undefined}
      {#each { length: TOTAL } as _, i}
        <span class="star {isFilled(i + 1) ? 'filled' : 'empty'}">★</span>
      {/each}
    {:else}
      <span class="no-value">—</span>
    {/if}
  </span>
{:else}
  <span class="star-rating interactive">
    {#each { length: TOTAL } as _, i}
      {@const idx = i + 1}
      <button
        type="button"
        class="star-btn {isFilled(idx) ? 'filled' : 'empty'}"
        aria-label={`${idx} estrela${idx > 1 ? 's' : ''}`}
        aria-pressed={value === idx}
        onclick={() => handleClick(idx)}
        onmouseenter={() => handleMouseEnter(idx)}
        onmouseleave={handleMouseLeave}
      >
        {isFilled(idx) ? '★' : '★'}
      </button>
    {/each}
    {#if value !== undefined}
      <button
        type="button"
        class="clear-btn"
        aria-label="Limpar avaliação"
        onclick={clearValue}
        onmouseenter={() => { hovered = undefined }}
      >
        ✕
      </button>
    {/if}
  </span>
{/if}

<style>
  .star-rating {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  /* Readonly — compact, fixed width so every star occupies the same space */
  .star {
    display: inline-flex;
    justify-content: center;
    width: 18px;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .star.filled {
    color: var(--warning);
  }

  .star.empty {
    color: var(--border);
  }

  .no-value {
    font-size: 18px;
    color: var(--text-muted);
  }

  /* Interactive */
  .star-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
    font-size: 22px;
    line-height: 1;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    transition: color 0.12s, transform 0.1s;
    border-radius: var(--radius);
  }

  .star-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .star-btn.filled {
    color: var(--warning);
  }

  .star-btn.empty {
    color: var(--border);
  }

  .star-btn:hover {
    transform: scale(1.15);
  }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    min-height: 28px;
    margin-left: 4px;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }

  .clear-btn:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  .clear-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
