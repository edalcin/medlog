<script lang="ts">
  import { onMount } from 'svelte'
  import * as api from '../lib/api'
  import type { UserSummary, Sharing } from '../lib/api'

  let otherUsers = $state<UserSummary[]>([])
  let proSharings = $state<Sharing[]>([])
  let clinicSharings = $state<Sharing[]>([])
  let loading = $state(true)
  let error = $state('')
  let toggling = $state<Record<string, boolean>>({})

  onMount(async () => {
    try {
      const [others, pros, clinics] = await Promise.all([
        api.getUsersOthers(),
        api.getProfessionalSharing(),
        api.getClinicSharing(),
      ])
      otherUsers = others
      proSharings = pros
      clinicSharings = clinics
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao carregar compartilhamentos'
    } finally {
      loading = false
    }
  })

  let proSharedSet = $derived(new Set(proSharings.map(s => s.sharingToUserId)))
  let clinicSharedSet = $derived(new Set(clinicSharings.map(s => s.sharingToUserId)))

  async function togglePro(userId: string) {
    const key = 'pro-' + userId
    if (toggling[key]) return
    toggling = { ...toggling, [key]: true }
    try {
      if (proSharedSet.has(userId)) {
        await api.deleteProfessionalSharing(userId)
        proSharings = proSharings.filter(s => s.sharingToUserId !== userId)
      } else {
        const s = await api.createProfessionalSharing(userId)
        proSharings = [...proSharings, s]
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao alterar compartilhamento'
    } finally {
      toggling = { ...toggling, [key]: false }
    }
  }

  async function toggleClinic(userId: string) {
    const key = 'clinic-' + userId
    if (toggling[key]) return
    toggling = { ...toggling, [key]: true }
    try {
      if (clinicSharedSet.has(userId)) {
        await api.deleteClinicSharing(userId)
        clinicSharings = clinicSharings.filter(s => s.sharingToUserId !== userId)
      } else {
        const s = await api.createClinicSharing(userId)
        clinicSharings = [...clinicSharings, s]
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Erro ao alterar compartilhamento'
    } finally {
      toggling = { ...toggling, [key]: false }
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Compartilhamento</h1>
  </div>

  <p class="desc">
    Compartilhe seus profissionais e clínicas com outros usuários do sistema.
    Usuários com acesso poderão visualizar, mas não editar, seus dados.
  </p>

  {#if loading}
    <div class="loading">Carregando...</div>
  {:else if error}
    <p class="error-msg">{error}</p>
  {:else if otherUsers.length === 0}
    <div class="empty">Nenhum outro usuário cadastrado no sistema.</div>
  {:else}
    <div class="sharing-grid">

      <div class="sharing-section">
        <h3>Profissionais</h3>
        <p class="section-desc">Selecione quais usuários podem ver seus profissionais.</p>
        <div class="user-list">
          {#each otherUsers as u (u.id)}
            {@const shared = proSharedSet.has(u.id)}
            {@const busy = toggling['pro-' + u.id]}
            <label class="user-row" class:shared>
              <input
                type="checkbox"
                checked={shared}
                disabled={busy}
                onchange={() => togglePro(u.id)}
              />
              <span class="user-name">{u.name}</span>
              {#if shared}
                <span class="badge badge-green">Compartilhado</span>
              {/if}
            </label>
          {/each}
        </div>
      </div>

      <div class="sharing-section">
        <h3>Clínicas</h3>
        <p class="section-desc">Selecione quais usuários podem ver suas clínicas.</p>
        <div class="user-list">
          {#each otherUsers as u (u.id)}
            {@const shared = clinicSharedSet.has(u.id)}
            {@const busy = toggling['clinic-' + u.id]}
            <label class="user-row" class:shared>
              <input
                type="checkbox"
                checked={shared}
                disabled={busy}
                onchange={() => toggleClinic(u.id)}
              />
              <span class="user-name">{u.name}</span>
              {#if shared}
                <span class="badge badge-green">Compartilhado</span>
              {/if}
            </label>
          {/each}
        </div>
      </div>

    </div>
  {/if}
</div>

<style>
  .desc {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 24px;
    max-width: 560px;
  }

  .sharing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .sharing-section {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .sharing-section h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .user-row:hover {
    border-color: var(--accent);
    background: var(--bg-elevated);
  }

  .user-row.shared {
    border-color: var(--success, #22c55e);
    background: rgba(34, 197, 94, 0.05);
  }

  .user-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .user-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .sharing-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
