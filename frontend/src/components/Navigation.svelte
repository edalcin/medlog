<script lang="ts">
  import { link, location, push } from '@keenmate/svelte-spa-router'
  import { currentUser, isAdmin, signout, setTheme } from '../lib/auth'

  async function handleSignout() {
    await signout()
    push('/signin')
  }

  const themeLabels: Record<string, string> = { SYSTEM: '⊙', LIGHT: '○', DARK: '●' }
  const themeNext: Record<string, 'LIGHT' | 'DARK' | 'SYSTEM'> = { SYSTEM: 'LIGHT', LIGHT: 'DARK', DARK: 'SYSTEM' }
  const themeTitles: Record<string, string> = { SYSTEM: 'Tema: Sistema', LIGHT: 'Tema: Claro', DARK: 'Tema: Escuro' }

  function cycleTheme() {
    const current = $currentUser?.theme ?? 'SYSTEM'
    setTheme(themeNext[current] ?? 'SYSTEM')
  }
</script>

<nav>
  <div class="nav-brand">MedLog</div>
  <div class="nav-links">
    <a href="/dashboard" use:link class:active={$location === '/' || $location === '/dashboard'}>
      Dashboard
    </a>
    <a href="/consultations" use:link class:active={$location === '/consultations'}>
      Consultas
    </a>
    <a href="/professionals" use:link class:active={$location.startsWith('/professionals')}>
      Profissionais
    </a>
    <a href="/files" use:link class:active={$location === '/files'}>
      Arquivos
    </a>
    <a href="/reports" use:link class:active={$location === '/reports'}>
      Relatórios
    </a>
    <a href="/sharing" use:link class:active={$location === '/sharing'}>
      Compartilhamento
    </a>
    {#if $isAdmin}
      <a href="/admin" use:link class:active={$location === '/admin'}>
        Admin
      </a>
    {/if}
  </div>
  <div class="nav-user">
    {#if $currentUser}
      <span class="user-name">{$currentUser.name}</span>
      {#if $currentUser.role === 'ADMIN'}
        <span class="badge badge-yellow">Admin</span>
      {/if}
      <button
        class="btn btn-ghost btn-sm theme-btn"
        onclick={cycleTheme}
        title={themeTitles[$currentUser.theme ?? 'SYSTEM']}
      >{themeLabels[$currentUser.theme ?? 'SYSTEM']}</button>
      <button class="btn btn-ghost btn-sm" onclick={handleSignout}>Sair</button>
    {/if}
  </div>
</nav>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 24px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 52px;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-brand {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.02em;
  }

  .nav-links {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .nav-links a {
    padding: 6px 14px;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 14px;
    text-decoration: none;
    transition: color 0.2s, background 0.2s;
  }

  .nav-links a:hover {
    color: var(--text);
    background: var(--bg-elevated);
    text-decoration: none;
  }

  .nav-links a.active {
    color: var(--accent);
    background: rgba(74, 158, 255, 0.1);
  }

  .nav-user {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .user-name {
    font-size: 13px;
    color: var(--text-muted);
  }

  .btn-sm {
    padding: 4px 12px;
    font-size: 13px;
  }

  .theme-btn {
    font-size: 16px;
    padding: 4px 8px;
    min-width: 32px;
    justify-content: center;
  }
</style>
