import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useData } from '../store'
import { Card, Badge, SectionLabel } from '../components/ui/Card'

export function PlannerControls() {
  const { data, busy, pendingAction, scheduleRevision, act } = useData()
  const [days, setDays] = useState(data?.settings.days_ahead ?? 7)
  const [hours, setHours] = useState(data?.settings.daily_hours ?? 3)
  return <Card><SectionLabel>Adaptive study planner</SectionLabel>
    <p className="muted">The rule-based agent uses topic difficulty, exam dates, revision gaps and quiz scores. Regeneration replaces pending sessions inside the selected horizon and keeps completed work.</p>
    <form className="form-row" onSubmit={e => { e.preventDefault(); void act(async () => {
      const result = await api.plan.generate({ days_ahead: days, daily_hours: hours })
      if (!result.success) throw new Error(result.explanation)
      return result.explanation
    }, { label: 'Generating study plan', revealSchedule: true }) }}>
      <label>Planning horizon (days)<input required type="number" min="1" max="60" value={days} onChange={e => setDays(Number(e.target.value))} /></label>
      <label>Daily study hours<input required type="number" min="0.5" max="10" step="0.5" value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
      <button className="primary" disabled={busy || !data?.topics.length}>{pendingAction === 'Generating study plan' ? 'Working…' : 'Generate study plan'}</button>
      <button type="button" disabled={busy || !data?.topics.length || days < 1 || days > 60 || hours < .5 || hours > 10} onClick={() => void act(async () => {
        const result = await api.plan.replan('Manual review of updated performance', { days_ahead: days, daily_hours: hours })
        if (!result.success) throw new Error(result.explanation)
        return result.explanation
      }, { label: 'Replanning study sessions', revealSchedule: true })}>{pendingAction === 'Replanning study sessions' ? 'Replanning...' : 'Replan now'}</button>
    </form>
    {!data?.topics.length && <p className="muted">Add a subject and topic to enable planning.</p>}
  </Card>
}

export function Sessions({ compact = false }: { compact?: boolean }) {
  const { data, busy, pendingAction, scheduleRevision, completeSession } = useData()
  const [filter, setFilter] = useState('pending')
  const previousRevision = useRef(scheduleRevision)
  useEffect(() => {
    if (scheduleRevision !== previousRevision.current) {
      setFilter('pending')
      document.querySelector('[data-session-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      previousRevision.current = scheduleRevision
    }
  }, [scheduleRevision])
  if (!data) return null
  const filtered = data.sessions.filter(s => filter === 'all' || (filter === 'done' ? s.status === 'done' : ['upcoming', 'active'].includes(s.status)))
  const shown = compact ? filtered.slice(0, 5) : filtered
  return <Card><div className="section-heading"><span data-session-list /><SectionLabel>{compact ? 'Next study sessions' : 'Study sessions'}</SectionLabel>
    <label className="inline-label">Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Pending</option><option value="done">Completed</option><option value="all">All sessions</option></select></label></div>
    {!shown.length && <p className="muted">No {filter === 'done' ? 'completed' : 'matching'} sessions yet. Generate a plan or choose another filter.</p>}
    {shown.map(s => <div className="record" key={s.id} data-session-id={s.id}>
      <div><strong>{s.topic_name}</strong><p className="muted">{s.subject_name} · {s.scheduled_date} at {s.scheduled_time} · {s.duration_minutes} min</p>
        <small>Priority {data.topics.find(t => t.id === s.topic_id)?.priority_score.toFixed(1) ?? '—'}/100 · {s.status}</small></div>
      {s.status !== 'done' && s.status !== 'skipped' ? <button type="button" disabled={busy} onClick={() => void completeSession(s.id)}>{pendingAction === `Completing session ${s.id}` ? 'Completing...' : 'Mark complete'}</button> : <Badge variant="sage">{s.status === 'done' ? 'Completed' : s.status}</Badge>}
    </div>)}
    {compact && filtered.length > 5 && <p className="muted">Showing 5 of {filtered.length}. Open Planner for all sessions.</p>}
  </Card>
}

export function TopicList({ query = '' }: { query?: string }) {
  const { data, busy, pendingAction, scheduleRevision, act } = useData()
  if (!data) return null
  const topics = data.topics.filter(t => `${t.name} ${t.subject_name}`.toLowerCase().includes(query.toLowerCase()))
  return <Card><SectionLabel>Topics & difficulty</SectionLabel>
    <p className="muted">Predictions come from a model trained on synthetic data; they are not validated educational assessments. Priority is recalculated when planning.</p>
    {!topics.length && <p className="muted">No matching topics. Add your first topic below.</p>}
    {topics.map(t => <div className="record" key={t.id}><div><strong>{t.name}</strong> {t.is_demo && <Badge>Demo</Badge>}
      <p className="muted">{t.subject_name} · Latest score {t.prev_quiz_score}% · Confidence {t.confidence}/10 · Priority {t.priority_score.toFixed(1)}/100</p>
      <p><Badge variant="pink">{t.predicted_difficulty ?? 'Not predicted'}</Badge>{t.predicted_difficulty && <small> Easy {((t.difficulty_prob_easy ?? 0) * 100).toFixed(1)}% · Medium {((t.difficulty_prob_medium ?? 0) * 100).toFixed(1)}% · Hard {((t.difficulty_prob_hard ?? 0) * 100).toFixed(1)}%</small>}</p>
    </div><button disabled={busy} onClick={() => void act(async () => {
      const prediction = await api.ml.predict({ topic_id: t.id, confidence: t.confidence, prev_quiz_score: t.prev_quiz_score, days_since_revision: t.days_since_revision, available_hours: t.available_hours, complexity: t.complexity })
      return `${t.name}: ${prediction.difficulty}. Probability scores saved.`
    }, { label: `Predicting ${t.name}` })}>{pendingAction === `Predicting ${t.name}` ? 'Predicting...' : 'Predict difficulty'}</button></div>)}
  </Card>
}

export function AgentActivity() {
  const { data } = useData()
  return <Card><SectionLabel>Agent activity</SectionLabel><p className="muted">Transparent rule-based agent with a local RandomForest classifier. No external LLM or paid service is used.</p>
    {!data?.logs.length && <p className="muted">Generate a plan to see the agent's decisions.</p>}
    {data?.logs.map(log => <details key={log.id} className="log"><summary>{log.action.replace(/_/g, ' ')} <small>{new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}</small></summary><p>{log.details}</p></details>)}
  </Card>
}

