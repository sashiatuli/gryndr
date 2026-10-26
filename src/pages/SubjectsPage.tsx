import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useData } from '../store'
import { Card, SectionLabel, Badge } from '../components/ui/Card'
import { TopicList } from './SharedPanels'

export function SubjectsPage({ query }: { query: string }) {
  const { data, busy, pendingAction, act } = useData()
  const [subjectId, setSubjectId] = useState('')
  if (!data) return null
  async function addSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget; const fields = new FormData(form)
    const ok = await act(async () => {
      const subject = await api.subjects.create({ name: String(fields.get('name')).trim(), exam_date: String(fields.get('exam_date')) || undefined, color: String(fields.get('color')) })
      setSubjectId(String(subject.id)); return `Subject ${subject.name} created.`
    }, { label: 'Saving subject' })
    if (ok) form.reset()
  }
  async function addTopic(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget; const fields = new FormData(form)
    const ok = await act(async () => {
      const topic = await api.topics.create({ subject_id: Number(fields.get('subject_id')), name: String(fields.get('name')).trim(), confidence: Number(fields.get('confidence')), prev_quiz_score: Number(fields.get('prev_quiz_score')), days_since_revision: Number(fields.get('days_since_revision')), available_hours: Number(fields.get('available_hours')), complexity: Number(fields.get('complexity')) })
      return `Topic ${topic.name} created.${topic.predicted_difficulty ? ` Predicted difficulty: ${topic.predicted_difficulty}.` : ' ML is unavailable; you can retry prediction later.'}`
    }, { label: 'Saving topic' })
    if (ok) form.reset()
  }
  return <div className="stack"><div className="two-column">
    <Card><SectionLabel>Your subjects</SectionLabel>{!data.subjects.length && <p className="muted">No subjects yet. Create one to get started.</p>}
      {data.subjects.map(s => <div className="record" key={s.id}><div><strong>{s.name}</strong>{data.topics.some(t => t.subject_id === s.id && t.is_demo) && <> <Badge>Contains demo topics</Badge></>}<p className="muted">{s.topic_count} topics · {s.exam_date ? `Exam ${s.exam_date}` : 'No exam date'}</p></div></div>)}
    </Card>
    <Card><SectionLabel>Add subject</SectionLabel><form className="stack form" onSubmit={addSubject}>
      <label>Subject name<input name="name" required maxLength={120} placeholder="e.g. Database Systems" /></label>
      <label>Exam date (optional)<input type="date" name="exam_date" /></label>
      <label>Subject color<input type="color" name="color" defaultValue="#DDA9BB" /></label>
      <button className="primary" disabled={busy}>{pendingAction === 'Saving subject' ? 'Saving subject...' : 'Add subject'}</button>
    </form></Card>
  </div><TopicList query={query} />
  <Card><SectionLabel>Add topic</SectionLabel><form className="form-grid" onSubmit={addTopic}>
    <label>Subject<select required name="subject_id" value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">Choose a subject</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Topic name<input name="name" required maxLength={200} /></label>
    <label>Confidence (1–10)<input name="confidence" type="number" min="1" max="10" step="0.5" defaultValue="5" required /></label>
    <label>Previous quiz / baseline score (%)<input name="prev_quiz_score" type="number" min="0" max="100" step="0.1" defaultValue="50" required /></label>
    <label>Days since revision<input name="days_since_revision" type="number" min="0" max="180" defaultValue="7" required /></label>
    <label>Available hours for this topic<input name="available_hours" type="number" min="0.5" max="12" step="0.5" defaultValue="2" required /></label>
    <label>Complexity (1–10)<input name="complexity" type="number" min="1" max="10" defaultValue="5" required /></label>
    <button className="primary" disabled={busy || !data.subjects.length}>{pendingAction === 'Saving topic' ? 'Saving topic...' : 'Add topic'}</button>
  </form>{!data.subjects.length && <p className="muted">Create a subject first.</p>}</Card></div>
}

export function QuizPanel() {
  const { data, busy, pendingAction, act } = useData()
  const [adapt, setAdapt] = useState(true)
  if (!data) return null
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget; const fields = new FormData(form)
    const topicId = Number(fields.get('topic_id')); const score = Number(fields.get('score'))
    const old = data!.topics.find(t => t.id === topicId)
    let saved = false
    await act(async () => {
      await api.quiz.add({ topic_id: topicId, score, notes: String(fields.get('notes')) || undefined }); saved = true
      const summary = `Quiz saved for ${old?.name}: ${old?.prev_quiz_score}% → ${score}%. Revision gap reset to 0.`
      if (!adapt) return summary + ' Use Replan now to update the schedule.'
      try {
        const result = await api.plan.replan(`Quiz for ${old?.name}: ${old?.prev_quiz_score}% to ${score}%`)
        if (!result.success) throw new Error(result.explanation)
        return summary + ' ' + result.explanation
      } catch (e) { throw new Error(summary + ` Replanning failed: ${e instanceof Error ? e.message : 'Unknown error'}. Retry with Replan now; do not resubmit the quiz.`) }
    }, { label: 'Saving quiz and updating performance', revealSchedule: adapt })
    if (saved) form.reset()
  }
  return <Card><SectionLabel>Record quiz result</SectionLabel><form className="form-grid" onSubmit={submit}>
    <label>Quiz topic<select name="topic_id" required defaultValue=""><option value="">Choose a topic</option>{data.topics.map(t => <option key={t.id} value={t.id}>{t.subject_name} / {t.name}</option>)}</select></label>
    <label>Quiz score (%)<input name="score" type="number" min="0" max="100" step="0.1" required /></label>
    <label>Quiz notes (optional)<input name="notes" maxLength={1000} /></label>
    <label className="checkbox"><input type="checkbox" checked={adapt} onChange={e => setAdapt(e.target.checked)} /> Replan after saving</label>
    <button className="primary" disabled={busy || !data.topics.length}>{pendingAction === 'Saving quiz and updating performance' ? 'Saving quiz...' : 'Save quiz result'}</button>
  </form>{!data.topics.length && <p className="muted">Add a topic to record a quiz.</p>}
  <details className="log"><summary>Quiz history ({data.quizzes.length})</summary>{!data.quizzes.length && <p className="muted">No recorded quizzes yet.</p>}{data.quizzes.map(q => <p key={q.id}>{data.topics.find(t => t.id === q.topic_id)?.name} · {q.score}% · {new Date(q.taken_at + 'Z').toLocaleString()}{q.notes && ` · ${q.notes}`}</p>)}</details>
  </Card>
}
