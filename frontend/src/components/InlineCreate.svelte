<script lang="ts">
  import * as api from '../lib/api'

  let {
    resourceType,
    label,
    onCreated,
  } = $props<{
    resourceType: 'specialties' | 'file-categories' | 'clinics'
    label: string
    onCreated: (item: { id: string; name: string }) => void
  }>()

  let open = $state(false)
  let name = $state('')
  let saving = $state(false)
  let error = $state('')

  async function submit() {
    if (!name.trim()) return
    saving = true
    error = ''
    try {
      let created: { id: string; name: string }
      if (resourceType === 'specialties') {
        created = await api.createSpecialty(name.trim())
      } else if (resourceType === 'file-categories') {
        created = await api.createCategory(name.trim())
      } else {
        created = await api.createClinic(name.trim())
      }
      onCreated(created)
      name = ''
      open = false
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao criar'
    } finally {
      saving = false
    }
  }

  function cancel() {
    open = false
    name = ''
    error = ''
  }
</script>

{#if !open}
  <button type="button" class="btn-inline-create" onclick={() => (open = true)}>
    + Criar {label}
  </button>
{:else}
  <div class="inline-form">
    <input
      bind:value={name}
      placeholder="Nome do {label}"
      disabled={saving}
      onkeydown={(e) => e.key === 'Enter' && submit()}
    />
    <button type="button" class="btn btn-primary btn-xs" onclick={submit} disabled={saving || !name.trim()}>
      {saving ? '...' : 'Salvar'}
    </button>
    <button type="button" class="btn btn-ghost btn-xs" onclick={cancel} disabled={saving}>
      Cancelar
    </button>
    {#if error}
      <span class="err">{error}</span>
    {/if}
  </div>
{/if}

<style>
  .btn-inline-create {
    background: transparent;
    border: 1px dashed var(--border);
    color: var(--text-muted);
    padding: 4px 10px;
    border-radius: var(--radius);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .btn-inline-create:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .inline-form {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .inline-form input {
    flex: 1;
    min-width: 160px;
    padding: 5px 10px;
    font-size: 13px;
  }

  .btn-xs {
    padding: 5px 10px;
    font-size: 12px;
  }

  .err {
    color: var(--danger);
    font-size: 12px;
  }
</style>
