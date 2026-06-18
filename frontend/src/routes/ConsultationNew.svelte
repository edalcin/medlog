<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from '@keenmate/svelte-spa-router'
  import * as api from '../lib/api'
  import type { Professional } from '../lib/api'
  import FileUpload from '../components/FileUpload.svelte'
  import InlineCreate from '../components/InlineCreate.svelte'
  import StarRating from '../components/StarRating.svelte'
  import TipTapEditor from '../components/TipTapEditor.svelte'

  let professionals = $state<Professional[]>([])
  let loading = $state(true)
  let submitting = $state(false)
  let error = $state('')

  let date = $state(new Date().toISOString().split('T')[0])
  let type = $state('CONSULTATION')
  let proposito = $state('')
  let notes = $state('')
  let professionalId = $state('')
  let rating = $state<number | undefined>(undefined)

  // Created consultation ID — enables file upload section after save
  let createdId = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await api.getProfessionals(true)
      professionals = res.data
    } catch {
      // Non-critical — user can still create without professional
    } finally {
      loading = false
    }
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    submitting = true
    error = ''
    try {
      const c = await api.createConsultation({
        date,
        type,
        proposito: proposito || undefined,
        notes: notes || undefined,
        professionalId: professionalId || undefined,
        rating,
      })
      createdId = c.id
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao criar consulta'
      submitting = false
    }
  }

  function goToDetail() {
    if (createdId) push(`/consultations/${createdId}`)
  }

  function resetForm() {
    createdId = null
    date = new Date().toISOString().split('T')[0]
    type = 'CONSULTATION'
    proposito = ''
    notes = ''
    professionalId = ''
    rating = undefined
    error = ''
    submitting = false
  }

  function onProfessionalCreated(item: { id: string; name: string }) {
    professionals = [...professionals, { id: item.id, name: item.name, isActive: true, isShared: false, specialties: [], consultations: [], totalRatings: 0 }]
    professionalId = item.id
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <button class="btn btn-ghost" onclick={() => push('/consultations')} style="font-size:13px;padding:4px 10px;margin-bottom:8px">← Voltar</button>
      <h1>Nova Consulta</h1>
    </div>
  </div>

  {#if createdId}
    <div class="card">
      <p class="success-msg" style="margin-bottom:16px">Consulta criada com sucesso!</p>

      <FileUpload
        consultationId={createdId}
        professionalId={professionalId || undefined}
      />

      <div style="margin-top:20px;display:flex;gap:10px">
        <button class="btn btn-primary" onclick={goToDetail}>Ver Consulta →</button>
        <button class="btn btn-ghost" onclick={resetForm}>Nova Consulta</button>
      </div>
    </div>
  {:else}
    <form class="card" onsubmit={handleSubmit}>
      <div class="form-row">
        <div class="form-group">
          <label for="date">Data *</label>
          <input id="date" type="date" bind:value={date} required disabled={submitting} />
        </div>
        <div class="form-group">
          <label for="type">Tipo *</label>
          <select id="type" bind:value={type} disabled={submitting}>
            <option value="CONSULTATION">Consulta</option>
            <option value="EVENT">Evento</option>
          </select>
        </div>
        <div class="form-group">
          <span class="form-label">Avaliação</span>
          <StarRating bind:value={rating} />
        </div>
      </div>
      <div class="form-group">
        <label for="professional">Profissional</label>
        {#if loading}
          <select disabled><option>Carregando...</option></select>
        {:else}
          <select id="professional" bind:value={professionalId} disabled={submitting}>
            <option value="">Nenhum</option>
            {#each professionals as p}
              <option value={p.id}>{p.name}{p.specialties.length > 0 ? ` — ${p.specialties[0].name}` : ''}</option>
            {/each}
          </select>
          <InlineCreate resourceType="professionals" label="profissional" onCreated={onProfessionalCreated} />
        {/if}
      </div>

      <div class="form-group">
        <label for="proposito">Propósito</label>
        <input id="proposito" type="text" bind:value={proposito} placeholder="Motivo da consulta" disabled={submitting} />
      </div>

      <div class="form-group">
        <span class="form-label">Notas</span>
        <TipTapEditor bind:value={notes} disabled={submitting} />
      </div>

      {#if error}
        <p class="error-msg" style="margin-bottom:12px">{error}</p>
      {/if}

      <button type="submit" class="btn btn-primary" disabled={submitting || !date}>
        {submitting ? 'Criando...' : 'Criar Consulta'}
      </button>
    </form>
  {/if}
</div>

<style>
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0 16px;
  }
</style>
