<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Professional, Specialty, Clinic, Phone } from '../lib/api'
  import InlineCreate from '../components/InlineCreate.svelte'

  let { params } = $props<{ params: Record<string, string> }>()

  let isNew = $derived(params.id === 'new')

  let professional = $state<Professional | null>(null)
  let specialties = $state<Specialty[]>([])
  let clinics = $state<Clinic[]>([])
  let loading = $state(true)
  let saving = $state(false)
  let deleting = $state(false)
  let error = $state('')
  let saveError = $state('')

  // Phones
  let phones = $state<Phone[]>([])
  let newPhoneNumber = $state('')
  let newPhoneLabel = $state('')
  let phoneError = $state('')
  let editingPhone = $state<Phone | null>(null)
  let editPhoneNumber = $state('')
  let editPhoneLabel = $state('')

  // Form fields
  let name = $state('')
  let crm = $state('')
  let notes = $state('')
  let isActive = $state(true)
  let selectedSpecialtyIds = $state<string[]>([])
  let clinicId = $state('')

  onMount(async () => {
    try {
      const [specsRes, clinicsRes] = await Promise.all([
        api.getSpecialties(),
        api.getClinics(),
      ])
      specialties = specsRes.data
      clinics = clinicsRes.data

      if (!isNew) {
        const [p, phonesRes] = await Promise.all([
          api.getProfessional(params.id),
          api.getProfessionalPhones(params.id),
        ])
        professional = p
        name = p.name
        crm = p.crm ?? ''
        notes = p.notes ?? ''
        isActive = p.isActive
        selectedSpecialtyIds = p.specialties.map(s => s.id)
        clinicId = p.clinicId ?? ''
        phones = phonesRes
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar dados'
    } finally {
      loading = false
    }
  })

  function toggleSpecialty(id: string) {
    if (selectedSpecialtyIds.includes(id)) {
      selectedSpecialtyIds = selectedSpecialtyIds.filter(s => s !== id)
    } else {
      selectedSpecialtyIds = [...selectedSpecialtyIds, id]
    }
  }

  function onSpecialtyCreated(item: { id: string; name: string }) {
    specialties = [...specialties, item]
    selectedSpecialtyIds = [...selectedSpecialtyIds, item.id]
  }

  function onClinicCreated(item: { id: string; name: string }) {
    clinics = [...clinics, item]
    clinicId = item.id
  }

  async function addPhone(e: Event) {
    e.preventDefault()
    if (!professional || !newPhoneNumber.trim()) return
    phoneError = ''
    try {
      const p = await api.createProfessionalPhone(professional.id, newPhoneNumber.trim(), newPhoneLabel.trim() || undefined)
      phones = [...phones, p]
      newPhoneNumber = ''
      newPhoneLabel = ''
    } catch (err: unknown) {
      phoneError = err instanceof Error ? err.message : 'Erro ao adicionar'
    }
  }

  async function savePhone() {
    if (!editingPhone) return
    phoneError = ''
    try {
      const p = await api.updatePhone(editingPhone.id, editPhoneNumber.trim(), editPhoneLabel.trim() || undefined)
      phones = phones.map(x => x.id === p.id ? p : x)
      editingPhone = null
    } catch (err: unknown) {
      phoneError = err instanceof Error ? err.message : 'Erro ao salvar'
    }
  }

  async function removePhone(id: string) {
    if (!confirm('Excluir telefone?')) return
    phoneError = ''
    try {
      await api.deletePhone(id)
      phones = phones.filter(p => p.id !== id)
    } catch (err: unknown) {
      phoneError = err instanceof Error ? err.message : 'Erro ao excluir'
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault()
    saving = true
    saveError = ''
    try {
      if (isNew) {
        const created = await api.createProfessional({
          name,
          notes: notes || undefined,
          isActive,
          specialtyIds: selectedSpecialtyIds,
          clinicId: clinicId || undefined,
        })
        push(`/professionals/${created.id}`)
      } else if (professional) {
        const updated = await api.updateProfessional(professional.id, {
          name,
          crm: crm || undefined,
          notes: notes || undefined,
          isActive,
          specialtyIds: selectedSpecialtyIds,
          clinicId: clinicId || undefined,
        })
        professional = updated
        specialties = await api.getSpecialties().then(r => r.data)
      }
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : 'Erro ao salvar'
    } finally {
      saving = false
    }
  }

  async function handleDelete() {
    if (!professional) return
    if (!confirm(`Excluir o profissional "${professional.name}"?`)) return
    deleting = true
    try {
      await api.deleteProfessional(professional.id)
      push('/professionals')
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string }
      if (err.status === 409) {
        saveError = 'Este profissional possui consultas associadas e não pode ser excluído.'
      } else {
        saveError = err.message || 'Erro ao excluir'
      }
      deleting = false
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <button class="btn btn-ghost" onclick={() => push('/professionals')} style="font-size:13px;padding:4px 10px;margin-bottom:8px">
        ← Voltar
      </button>
      <h1>{isNew ? 'Novo Profissional' : (professional?.name ?? 'Profissional')}</h1>
    </div>
    {#if !isNew && professional}
      <button class="btn btn-danger" onclick={handleDelete} disabled={deleting}>
        {deleting ? 'Excluindo...' : 'Excluir'}
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else}
    <form class="card" onsubmit={handleSave}>
      <div class="form-row">
        <div class="form-group">
          <label for="name">Nome *</label>
          <input id="name" type="text" bind:value={name} required disabled={saving} placeholder="Nome completo" />
        </div>
        <div class="form-group">
          <label for="crm">CRM</label>
          <input id="crm" type="text" bind:value={crm} disabled={saving} placeholder="Número do CRM" />
        </div>
      </div>

      <div class="form-group">
        <span class="field-label">Status</span>
        <label class="toggle-label">
          <input type="checkbox" bind:checked={isActive} disabled={saving} />
          <span>{isActive ? 'Ativo' : 'Inativo'}</span>
        </label>
      </div>

      <div class="form-group">
        <span class="field-label">Especialidades</span>
        <div class="specialty-grid">
          {#each specialties as s}
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={selectedSpecialtyIds.includes(s.id)}
                onchange={() => toggleSpecialty(s.id)}
                disabled={saving}
              />
              {s.name}
            </label>
          {/each}
        </div>
        <div style="margin-top:8px">
          <InlineCreate resourceType="specialties" label="especialidade" onCreated={onSpecialtyCreated} />
        </div>
      </div>

      <div class="form-group">
        <label for="clinic">Clínica / Hospital</label>
        <select id="clinic" bind:value={clinicId} disabled={saving}>
          <option value="">Nenhuma</option>
          {#each clinics as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
        <div style="margin-top:8px">
          <InlineCreate resourceType="clinics" label="clínica" showAddress={true} onCreated={onClinicCreated} />
        </div>
      </div>

      <div class="form-group">
        <label for="notes">Notas</label>
        <textarea id="notes" rows="4" bind:value={notes} disabled={saving} placeholder="Informações adicionais..."></textarea>
      </div>

      {#if saveError}
        <p class="error-msg" style="margin-bottom:12px">{saveError}</p>
      {/if}

      <button type="submit" class="btn btn-primary" disabled={saving || !name.trim()}>
        {saving ? 'Salvando...' : (isNew ? 'Criar Profissional' : 'Salvar')}
      </button>
    </form>

    {#if !isNew}
      <div class="card phones-section">
        <h3>Telefones</h3>
        {#if phoneError}
          <p class="error-msg" style="margin-bottom:8px">{phoneError}</p>
        {/if}
        {#if phones.length > 0}
          <table style="margin-bottom:12px">
            <tbody>
              {#each phones as ph (ph.id)}
                <tr>
                  <td>
                    {#if editingPhone?.id === ph.id}
                      <input type="tel" bind:value={editPhoneNumber} placeholder="Número" style="width:160px" />
                    {:else}
                      {ph.number}
                    {/if}
                  </td>
                  <td>
                    {#if editingPhone?.id === ph.id}
                      <input type="text" bind:value={editPhoneLabel} placeholder="Rótulo (opcional)" style="width:140px" />
                    {:else}
                      <span style="color:var(--text-muted);font-size:12px">{ph.label ?? ''}</span>
                    {/if}
                  </td>
                  <td class="actions-cell">
                    {#if editingPhone?.id === ph.id}
                      <button class="btn btn-primary btn-xs" onclick={savePhone}>Salvar</button>
                      <button class="btn btn-ghost btn-xs" onclick={() => (editingPhone = null)}>Cancelar</button>
                    {:else}
                      <button class="btn btn-ghost btn-xs" onclick={() => { editingPhone = ph; editPhoneNumber = ph.number; editPhoneLabel = ph.label ?? '' }}>Editar</button>
                      <button class="btn btn-danger btn-xs" onclick={() => removePhone(ph.id)}>Excluir</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
        <form class="inline-phone-form" onsubmit={addPhone}>
          <input type="tel" bind:value={newPhoneNumber} placeholder="Número *" required style="width:160px" />
          <input type="text" bind:value={newPhoneLabel} placeholder="Rótulo (ex: Celular)" style="width:140px" />
          <button type="submit" class="btn btn-primary btn-xs">Adicionar</button>
        </form>
      </div>
    {/if}
  {/if}
</div>

<style>
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0 16px;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    width: auto;
    padding: 0;
    accent-color: var(--accent);
  }

  .specialty-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    transition: border-color 0.2s;
  }

  .checkbox-label:hover {
    border-color: var(--accent);
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    padding: 0;
    margin: 0;
    border: none;
    accent-color: var(--accent);
  }

  .phones-section {
    margin-top: 20px;
  }

  .phones-section h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .inline-phone-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .actions-cell {
    display: flex;
    gap: 6px;
  }

  .btn-xs {
    padding: 3px 10px;
    font-size: 12px;
  }
</style>
