<script lang="ts">
  import { push } from '@keenmate/svelte-spa-router'
  import { signin } from '../lib/auth'
  import { currentUser } from '../lib/auth'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')

  // Redirect if already signed in
  $effect(() => {
    if ($currentUser) {
      push('/consultations')
    }
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!email || !password) return
    loading = true
    error = ''
    try {
      await signin(email, password)
      push('/consultations')
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Falha ao entrar'
    } finally {
      loading = false
    }
  }
</script>

<div class="signin-page">
  <div class="signin-card">
    <div class="signin-header">
      <h1>MedLog</h1>
      <p>Prontuário médico familiar</p>
    </div>

    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="email">E-mail</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="seu@email.com"
          disabled={loading}
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Senha</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          disabled={loading}
          required
        />
      </div>

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}

      <button type="submit" class="btn btn-primary" style="width:100%" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  </div>
</div>

<style>
  .signin-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 20px;
  }

  .signin-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 40px;
    width: 100%;
    max-width: 380px;
  }

  .signin-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .signin-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 6px;
  }

  .signin-header p {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
