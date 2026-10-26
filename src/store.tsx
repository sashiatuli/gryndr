import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type Subject, type Topic, type Session, type Analytics, type AgentLogEntry, type QuizResult, type PlanSettings } from './api/client'

interface Data { subjects: Subject[]; topics: Topic[]; sessions: Session[]; analytics: Analytics; logs: AgentLogEntry[]; quizzes: QuizResult[]; settings: PlanSettings }
interface ActionOptions { label?: string; revealSchedule?: boolean }
interface Store {
  data: Data | null; loading: boolean; busy: boolean; error: string; message: string; pendingAction: string; scheduleRevision: number
  completeSession: (sessionId: number) => Promise<boolean>; dismissFeedback: () => void; refresh: () => Promise<void>; act: (work: () => Promise<string>, options?: ActionOptions) => Promise<boolean>
}
const Context = createContext<Store | null>(null)
const describe = (e: unknown) => e instanceof Error ? e.message : 'The request failed. Try again.'
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)
  const snapshot = useRef<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [scheduleRevision, setScheduleRevision] = useState(0)
  const lock = useRef(false)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const request = ++generation.current
    const keys = ['subjects', 'topics', 'sessions', 'analytics', 'logs', 'quizzes', 'settings'] as const
    const results = await Promise.allSettled([
      api.subjects.list(), api.topics.list(), api.plan.get(), api.analytics.get(), api.agentLogs.list(100), api.quiz.list(), api.settings(),
    ])
    // A slow initial/older refresh must never overwrite newer mutation results.
    if (request !== generation.current) return
    const failures: string[] = []
    const next = { ...snapshot.current }
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') Object.assign(next, { [keys[index]]: result.value })
      else failures.push(`${keys[index]}: ${describe(result.reason)}`)
    })
    // Keep successful updates even if an unrelated panel fails to refresh.
    if (keys.every(key => key in next)) { snapshot.current = next as Data; setData(next as Data) }
    if (failures.length) throw new Error(failures.join('; '))
  }, [])
  const refresh = useCallback(async () => {
    if (lock.current) return
    setLoading(true); setError(''); setMessage('')
    try { await load(); setMessage('Study data refreshed from the database.') }
    catch (e) { setError(describe(e)) }
    finally { setLoading(false) }
  }, [load])
  useEffect(() => {
    let active = true
    void load().catch(e => { if (active) setError(describe(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])
  async function act(work: () => Promise<string>, options: ActionOptions = {}) {
    if (lock.current) return false
    lock.current = true
    ++generation.current // Invalidate any read that started before this write.
    setBusy(true); setPendingAction(options.label ?? 'Saving changes'); setError(''); setMessage('')
    let saved = false
    let actionError = ''
    try {
      try { setMessage(await work()); saved = true }
      catch (e) { actionError = describe(e); setError(actionError) }
      try { await load() }
      catch (e) { setError([actionError, `Could not refresh all data: ${describe(e)}. Use Refresh; do not repeat a successful save.`].filter(Boolean).join(' ')) }
      if (saved && options.revealSchedule) setScheduleRevision(value => value + 1)
    } finally {
      lock.current = false; setBusy(false); setPendingAction('')
    }
    return saved
  }
  async function completeSession(sessionId: number) {
    return act(async () => {
      const saved = await api.sessions.complete(sessionId);
      // Use the committed API response immediately. A separate GET may fail or be slow.
      const current = snapshot.current;
      if (current) {
        const sessions = current.sessions.map(session => session.id === saved.id ? saved : session);
        const completed = sessions.filter(session => session.status === 'done');
        const next = {
          ...current, sessions,
          analytics: {
            ...current.analytics,
            sessions_completed: completed.length,
            sessions_upcoming: sessions.filter(session => session.status === 'upcoming').length,
            total_study_minutes: completed.reduce((minutes, session) => minutes + session.duration_minutes, 0),
          },
        };
        snapshot.current = next;
        setData(next);
      }
      return `Completed ${saved.topic_name}. Saved ${saved.duration_minutes} minutes of study time.`;
    }, { label: `Completing session ${sessionId}` });
  }
  function dismissFeedback() { setError(''); setMessage('') }
  return <Context.Provider value={{ data, loading, busy, error, message, pendingAction, scheduleRevision, completeSession, dismissFeedback, refresh, act }}>{children}</Context.Provider>
}
export function useData() {
  const value = useContext(Context)
  if (!value) throw new Error('DataProvider is required')
  return value
}
