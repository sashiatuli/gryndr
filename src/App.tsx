import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage, Stats, AnalyticsPanels } from './pages/DashboardPage'
import { SubjectsPage, QuizPanel } from './pages/SubjectsPage'
import { PlannerControls, Sessions, TopicList, AgentActivity } from './pages/SharedPanels'
import { DataProvider, useData } from './store'
import { Card, SectionLabel } from './components/ui/Card'
import { API_BASE } from './api/client'
const pages: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Your adaptive study companion'], planner: ['Planner', 'Plan, study and track your progress'],
  subjects: ['Subjects', 'Your subjects, topics and difficulty predictions'], analytics: ['Analytics', 'Progress from your recorded study activity'],
  ai: ['AI Coach', 'Transparent rule-based planning decisions'], settings: ['Settings', 'Local app configuration'],
}
function Workspace() {
  const currentPage = () => window.location.hash.slice(1) in pages ? window.location.hash.slice(1) : 'dashboard'
  const [page, setPage] = useState(currentPage)
  function navigate(next: string) { window.location.hash = next; setPage(next) }
  useEffect(() => {
    const onHashChange = () => setPage(currentPage())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => { window.scrollTo(0, 0); document.querySelector('main')?.scrollTo?.(0, 0) }, [page])
  const [query, setQuery] = useState('')
  const { data, loading, busy, error, message, pendingAction, dismissFeedback, refresh } = useData()
  return <AppLayout activePage={page} onNavigate={navigate} pageTitle={pages[page][0]} pageSubtitle={pages[page][1]} query={query} onSearch={q => { setQuery(q); navigate('subjects') }}>
    <div className="stack">
      <div className="toolbar"><span className="muted">{busy ? 'Saving and refreshing…' : loading ? 'Loading your study data…' : error ? 'Data needs attention' : 'Saved locally in SQLite'}</span><button disabled={busy || loading} onClick={() => void refresh()}>Refresh</button></div>
      {(busy || loading || error || message) && <div className="action-feedback" aria-label="Action feedback" aria-busy={busy || loading}>
        {!busy && !loading && <button className="dismiss-feedback" aria-label="Dismiss feedback" onClick={dismissFeedback}>Dismiss</button>}
        {(busy || loading) && <p className="notice" role="status">{busy ? `${pendingAction}...` : 'Loading study data...'}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
      </div>}
      {!data && !loading && <Card><p>Study data is unavailable. Start the backend, then use Refresh.</p></Card>}
      {data && <>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'subjects' && <SubjectsPage query={query} />}
        {page === 'planner' && <><PlannerControls /><Sessions /><QuizPanel /></>}
        {page === 'analytics' && <><Stats /><AnalyticsPanels /><QuizPanel /></>}
        {page === 'ai' && <><PlannerControls /><Sessions /><QuizPanel /><TopicList /><AgentActivity /></>}
        {page === 'settings' && <Card><SectionLabel>Local setup</SectionLabel><p>API: <code>{API_BASE}</code></p><p>Saved planner defaults: {data.settings.days_ahead} days, {data.settings.daily_hours} hours/day.</p><p className="muted">Generate or replan to save new defaults. Quiz replanning uses those defaults, starting today.</p><p className="muted">API URL can be configured with VITE_API_URL in .env.local, then restart Vite.</p><p className="muted">This is a single-user local app. It uses SQLite, a synthetic-data ML model and a rule-based agent.</p><a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">Open API documentation</a></Card>}
      </>}
    </div>
  </AppLayout>
}
export default function App() { return <DataProvider><Workspace /></DataProvider> }
