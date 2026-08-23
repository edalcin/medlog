<script lang="ts">
  import { onMount } from 'svelte'
  import Router, { push, location } from '@keenmate/svelte-spa-router'
  import { currentUser, authLoading, loadCurrentUser } from './lib/auth'
  import Navigation from './components/Navigation.svelte'
  import SignIn from './routes/SignIn.svelte'
  import ConsultationList from './routes/ConsultationList.svelte'
  import ConsultationDetail from './routes/ConsultationDetail.svelte'
  import ConsultationNew from './routes/ConsultationNew.svelte'
  import ProfessionalList from './routes/ProfessionalList.svelte'
  import ProfessionalDetail from './routes/ProfessionalDetail.svelte'
  import Reports from './routes/Reports.svelte'
  import Admin from './routes/Admin.svelte'
  import Dashboard from './routes/Dashboard.svelte'
  import Sharing from './routes/Sharing.svelte'
  import Files from './routes/Files.svelte'
  import ExtractionReview from './routes/ExtractionReview.svelte'
  import HealthSeries from './routes/HealthSeries.svelte'

  import './app.css'

  const routes = {
    '/': Dashboard,
    '/dashboard': Dashboard,
    '/signin': SignIn,
    '/consultations': ConsultationList,
    '/consultations/new': ConsultationNew,
    '/consultations/:id': ConsultationDetail,
    '/professionals': ProfessionalList,
    '/professionals/:id': ProfessionalDetail,
    '/files': Files,
    '/indicators': HealthSeries,
    '/reports': Reports,
    '/sharing': Sharing,
    '/extractions/:id/review': ExtractionReview,
    '/admin': Admin,
  }

  onMount(async () => {
    await loadCurrentUser()
  })

  const publicRoutes = ['/signin']

  $effect(() => {
    if (!$authLoading && !$currentUser && !publicRoutes.includes($location)) {
      push('/signin')
    }
  })

  $effect(() => {
    const theme = $currentUser?.theme ?? 'SYSTEM'
    if (theme === 'SYSTEM') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme.toLowerCase())
    }
  })
</script>

{#if $authLoading}
  <div class="app-loading">Carregando...</div>
{:else}
  {#if $currentUser}
    <Navigation />
  {/if}
  <main>
    <Router {routes} />
  </main>
{/if}

<style>
  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: #4a9eff;
    font-size: 16px;
  }
</style>
