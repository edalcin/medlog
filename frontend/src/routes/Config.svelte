<script lang="ts">
  import { get } from 'svelte/store'
  import * as api from '../lib/api'
  import { currentUser } from '../lib/auth'

  const initial = get(currentUser)
  const originalEmail = initial?.email ?? ''

  // Bloco 1 — Identificação
  let name = $state(initial?.name ?? '')
  let email = $state(initial?.email ?? '')
  let identityPassword = $state('')
  let emailChanged = $derived(email !== originalEmail)

  // Bloco 3 — Dados para as faixas de normalidade
  let biologicalSex = $state<'M' | 'F' | ''>(initial?.biologicalSex ?? '')
  let birthDate = $state(initial?.birthDate ?? '')

  let profileSaving = $state(false)
  let profileError = $state('')
  let profileSuccess = $state('')

  async function saveProfile(e: Event) {
    e.preventDefault()
    profileSaving = true
    profileError = ''
    profileSuccess = ''
    try {
      const body: Parameters<typeof api.updateMe>[0] = {
        name,
        email,
        biologicalSex: biologicalSex || null,
        birthDate: birthDate || null,
      }
      if (emailChanged) body.currentPassword = identityPassword
      const updated = await api.updateMe(body)
      currentUser.set(updated)
      identityPassword = ''
      profileSuccess = 'Dados atualizados com sucesso.'
    } catch (err: unknown) {
      const e2 = err as { status?: number; message?: string }
      if (e2.status === 401) profileError = 'Senha atual incorreta.'
      else if (e2.status === 409) profileError = 'Este e-mail já está em uso por outro usuário.'
      else profileError = e2.message || 'Erro ao salvar as alterações.'
    } finally {
      profileSaving = false
    }
  }

  // Bloco 2 — Senha
  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let passwordSaving = $state(false)
  let passwordError = $state('')
  let passwordSuccess = $state('')

  async function savePassword(e: Event) {
    e.preventDefault()
    passwordError = ''
    passwordSuccess = ''
    if (newPassword !== confirmPassword) {
      passwordError = 'A confirmação não corresponde à nova senha.'
      return
    }
    passwordSaving = true
    try {
      await api.changePassword(currentPassword, newPassword)
      passwordSuccess = 'Senha alterada com sucesso.'
      currentPassword = ''
      newPassword = ''
      confirmPassword = ''
    } catch (err: unknown) {
      const e2 = err as { status?: number; message?: string }
      if (e2.status === 401) passwordError = 'Senha atual incorreta.'
      else passwordError = e2.message || 'Erro ao alterar a senha.'
    } finally {
      passwordSaving = false
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Configurações</h1>
  </div>

  <form class="card" onsubmit={saveProfile}>
    <h3>Identificação</h3>
    <div class="form-row">
      <div class="form-group">
        <label for="name">Nome</label>
        <input id="name" type="text" bind:value={name} required disabled={profileSaving} />
      </div>
      <div class="form-group">
        <label for="email">E-mail</label>
        <input id="email" type="email" bind:value={email} required disabled={profileSaving} />
      </div>
    </div>
    <p class="hint">O e-mail é a credencial de login. Trocá-lo troca também com que você entra no sistema.</p>

    {#if emailChanged}
      <div class="form-group">
        <label for="identity-password">Senha atual</label>
        <input
          id="identity-password"
          type="password"
          bind:value={identityPassword}
          placeholder="Confirme a senha atual para trocar o e-mail"
          required
          disabled={profileSaving}
        />
      </div>
    {/if}

    <h3 style="margin-top:20px">Dados para as faixas de normalidade</h3>
    <div class="form-row">
      <div class="form-group">
        <label for="biological-sex">Sexo biológico</label>
        <select id="biological-sex" bind:value={biologicalSex} disabled={profileSaving}>
          <option value="">Não informado</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      </div>
      <div class="form-group">
        <label for="birth-date">Data de nascimento</label>
        <input id="birth-date" type="date" bind:value={birthDate} disabled={profileSaving} />
      </div>
    </div>
    <p class="hint">
      As faixas de normalidade de vários exames — hemoglobina, hematócrito, creatinina, ácido úrico, PSA, entre
      outros — dependem de sexo biológico e idade. Sem esses dados, a tela de Indicadores não consegue mostrar a
      faixa. O dado fica só no seu servidor e nunca é enviado ao provedor de IA.
    </p>

    {#if profileError}
      <p class="error-msg">{profileError}</p>
    {/if}
    {#if profileSuccess}
      <p class="success-msg">{profileSuccess}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={profileSaving}>
      {profileSaving ? 'Salvando...' : 'Salvar alterações'}
    </button>
  </form>

  <form class="card" onsubmit={savePassword}>
    <h3>Senha</h3>
    <div class="form-row">
      <div class="form-group">
        <label for="current-password">Senha atual</label>
        <input id="current-password" type="password" bind:value={currentPassword} required disabled={passwordSaving} />
      </div>
      <div class="form-group">
        <label for="new-password">Nova senha</label>
        <input id="new-password" type="password" bind:value={newPassword} required disabled={passwordSaving} />
      </div>
      <div class="form-group">
        <label for="confirm-password">Confirmar nova senha</label>
        <input id="confirm-password" type="password" bind:value={confirmPassword} required disabled={passwordSaving} />
      </div>
    </div>

    {#if passwordError}
      <p class="error-msg">{passwordError}</p>
    {/if}
    {#if passwordSuccess}
      <p class="success-msg">{passwordSuccess}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={passwordSaving}>
      {passwordSaving ? 'Salvando...' : 'Alterar senha'}
    </button>
  </form>
</div>

<style>
  .form-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .form-row .form-group {
    flex: 1;
    min-width: 220px;
  }

  .card {
    margin-bottom: 20px;
  }

  .card h3 {
    margin-bottom: 14px;
  }

  .hint {
    font-size: 13px;
    color: var(--text-muted);
    margin: -6px 0 14px;
  }

  .error-msg,
  .success-msg {
    margin-bottom: 12px;
  }

  @media (max-width: 640px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
