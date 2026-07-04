<script lang="ts">
  import * as api from '../lib/api'
  import type { FileCategory } from '../lib/api'

  let {
    categories = $bindable<FileCategory[]>([]),
    selectedIds = $bindable<string[]>([]),
    disabled = false,
  } = $props<{
    categories: FileCategory[]
    selectedIds: string[]
    disabled?: boolean
  }>()

  let open = $state(false)
  let search = $state('')
  let newName = $state('')
  let adding = $state(false)
  let containerEl: HTMLDivElement | undefined = $state(undefined)

  let filtered = $derived(
    search.trim()
      ? categories.filter((c: FileCategory) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
      : categories
  )

  let selectedNames = $derived(
    categories.filter((c: FileCategory) => selectedIds.includes(c.id)).map((c: FileCategory) => c.name)
  )

  function toggle(id: string) {
    selectedIds = selectedIds.includes(id) ? selectedIds.filter((i: string) => i !== id) : [...selectedIds, id]
  }

  async function addCategory() {
    const name = newName.trim()
    if (!name) return
    adding = true
    try {
      const cat = await api.createCategory(name)
      categories = [...categories, cat]
      selectedIds = [...selectedIds, cat.id]
      newName = ''
    } catch {
      // ignore — category creation is best-effort
    } finally {
      adding = false
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) open = false
  }

  $effect(() => {
    if (!open) return
    window.addEventListener('click', handleOutsideClick, true)
    return () => window.removeEventListener('click', handleOutsideClick, true)
  })
</script>

<div class="category-select" bind:this={containerEl}>
  <button type="button" class="category-trigger" onclick={() => (open = !open)} disabled={disabled}>
    <span class="trigger-label" class:placeholder={selectedNames.length === 0}>
      {#if selectedNames.length === 0}
        Selecionar categorias
      {:else if selectedNames.length <= 2}
        {selectedNames.join(', ')}
      {:else}
        {selectedNames.length} categorias selecionadas
      {/if}
    </span>
    <span class="chevron">▾</span>
  </button>

  {#if open}
    <div class="category-panel">
      <input
        type="text"
        class="category-search"
        placeholder="Buscar categoria..."
        bind:value={search}
        disabled={disabled}
      />
      <div class="category-list">
        {#each filtered as cat (cat.id)}
          <label class="category-option">
            <input
              type="checkbox"
              checked={selectedIds.includes(cat.id)}
              onchange={() => toggle(cat.id)}
              disabled={disabled}
            />
            {cat.name}
          </label>
        {/each}
        {#if filtered.length === 0}
          <p class="category-empty">Nenhuma categoria encontrada.</p>
        {/if}
      </div>
      <div class="category-add-row">
        <input
          type="text"
          bind:value={newName}
          placeholder="Nova categoria..."
          disabled={adding || disabled}
          onkeydown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onclick={addCategory}
          disabled={!newName.trim() || adding || disabled}
        >
          {adding ? '...' : '+ Adicionar'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .category-select {
    position: relative;
  }

  .category-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 12px;
    font-size: 13px;
    text-align: left;
    transition: border-color 0.2s;
  }

  .category-trigger:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger-label.placeholder {
    color: var(--text-muted);
  }

  .chevron {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .category-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-search {
    font-size: 13px;
    padding: 6px 10px;
  }

  .category-list {
    display: flex;
    flex-direction: column;
    max-height: 220px;
    overflow-y: auto;
  }

  .category-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: var(--radius);
  }

  .category-option:hover {
    background: var(--bg-elevated);
  }

  .category-option input[type='checkbox'] {
    width: auto;
    padding: 0;
    margin: 0;
    border: none;
    accent-color: var(--accent);
  }

  .category-empty {
    font-size: 13px;
    color: var(--text-muted);
    padding: 6px 8px;
  }

  .category-add-row {
    display: flex;
    gap: 8px;
    align-items: center;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }

  .category-add-row input {
    flex: 1;
    font-size: 13px;
    padding: 6px 10px;
  }
</style>
