<script lang="ts">
  import { link, location, push } from '@keenmate/svelte-spa-router'
  import { currentUser, isAdmin, signout, setTheme } from '../lib/auth'

  let menuOpen = $state(false)

  async function handleSignout() {
    menuOpen = false
    await signout()
    push('/signin')
  }

  function navigate(path: string) {
    menuOpen = false
    push(path)
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

  <!-- Desktop links -->
  <div class="nav-links desktop-links">
    <a href="/dashboard" use:link class:active={$location === '/' || $location === '/dashboard'}>Dashboard</a>
    <a href="/consultations" use:link class:active={$location === '/consultations'}>Consultas</a>
    <a href="/professionals" use:link class:active={$location.startsWith('/professionals')}>Profissionais</a>
    <a href="/files" use:link class:active={$location === '/files'}>Arquivos</a>
    <a href="/indicators" use:link class:active={$location === '/indicators'}>Indicadores</a>
    <a href="/reports" use:link class:active={$location === '/reports'}>Relatórios</a>
    <a href="/sharing" use:link class:active={$location === '/sharing'}>Compartilhamento</a>
    {#if $isAdmin}
      <a href="/admin" use:link class:active={$location === '/admin'}>Admin</a>
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
      <button class="btn btn-ghost btn-sm desktop-only" onclick={handleSignout}>Sair</button>
      <button
        class="hamburger mobile-only"
        onclick={() => (menuOpen = !menuOpen)}
        aria-label="Menu"
        aria-expanded={menuOpen}
      >
        {#if menuOpen}✕{:else}☰{/if}
      </button>
    {/if}
  </div>
</nav>

{#if menuOpen}
  <div class="mobile-overlay" role="presentation" onclick={() => (menuOpen = false)}></div>
  <div class="mobile-menu">
    <button class="mobile-link" onclick={() => navigate('/dashboard')} class:active={$location === '/' || $location === '/dashboard'}>Dashboard</button>
    <button class="mobile-link" onclick={() => navigate('/consultations')} class:active={$location === '/consultations'}>Consultas</button>
    <button class="mobile-link" onclick={() => navigate('/professionals')} class:active={$location.startsWith('/professionals')}>Profissionais</button>
    <button class="mobile-link" onclick={() => navigate('/files')} class:active={$location === '/files'}>Arquivos</button>
    <button class="mobile-link" onclick={() => navigate('/indicators')} class:active={$location === '/indicators'}>Indicadores</button>
    <button class="mobile-link" onclick={() => navigate('/reports')} class:active={$location === '/reports'}>Relatórios</button>
    <button class="mobile-link" onclick={() => navigate('/sharing')} class:active={$location === '/sharing'}>Compartilhamento</button>
    {#if $isAdmin}
      <button class="mobile-link" onclick={() => navigate('/admin')} class:active={$location === '/admin'}>Admin</button>
    {/if}
    <hr class="mobile-divider" />
    <button class="mobile-link" onclick={handleSignout}>Sair</button>
  </div>
{/if}

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
    z-index: 200;
  }

  .nav-brand {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  .nav-links {
    display: flex;
    gap: 4px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .nav-links::-webkit-scrollbar {
    display: none;
  }

  .nav-links a {
    padding: 6px 14px;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 14px;
    text-decoration: none;
    white-space: nowrap;
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
    flex-shrink: 0;
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

  .hamburger {
    display: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 18px;
    padding: 4px 10px;
    cursor: pointer;
    line-height: 1;
  }

  .mobile-overlay {
    position: fixed;
    inset: 0;
    top: 52px;
    background: rgba(0, 0, 0, 0.4);
    z-index: 150;
  }

  .mobile-menu {
    position: fixed;
    top: 52px;
    left: 0;
    right: 0;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    z-index: 160;
    padding: 8px 0;
    display: flex;
    flex-direction: column;
  }

  .mobile-link {
    background: none;
    border: none;
    text-align: left;
    padding: 14px 24px;
    font-size: 15px;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .mobile-link:hover,
  .mobile-link.active {
    background: var(--bg-elevated);
    color: var(--accent);
  }

  .mobile-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }

  @media (max-width: 640px) {
    nav {
      padding: 0 16px;
      gap: 12px;
    }

    .desktop-links {
      display: none;
    }

    .desktop-only {
      display: none;
    }

    .hamburger {
      display: block;
    }

    .user-name {
      display: none;
    }
  }
</style>
