import { Timer, Target, TrendingUp, Award } from 'lucide-react'
import { useData } from '../store'
import { StatCard } from '../components/dashboard/StatCard'
import { ExamCountdown } from '../components/dashboard/ExamCountdown'
import { StudyProgress } from '../components/dashboard/StudyProgress'
import { Card, SectionLabel } from '../components/ui/Card'
import { PlannerControls, Sessions } from './SharedPanels'

export function Stats() {
  const { data } = useData()
  if (!data) return null
  const a = data.analytics
  return <div className="stats-grid">
    <StatCard icon={Timer} label="Study time" value={`${(a.total_study_minutes / 60).toFixed(1)} h`} sub="completed sessions · all time" accent="#DDA9BB" />
    <StatCard icon={Target} label="Topics" value={String(a.total_topics)} sub={`across ${a.total_subjects} subjects`} accent="#C98BA6" />
    <StatCard icon={TrendingUp} label="Average quiz" value={a.quiz_count ? `${a.average_quiz_score}%` : '—'} sub={a.quiz_count ? `${a.quiz_count} recorded quizzes` : 'No quiz results yet'} accent="#A7B5A0" />
    <StatCard icon={Award} label="Sessions done" value={String(a.sessions_completed)} sub={`${a.sessions_upcoming} pending sessions`} accent="#8A5C70" />
  </div>
}
export function AnalyticsPanels() {
  const { data } = useData()
  if (!data) return null
  return <div className="stack"><StudyProgress weeklyProgress={data.analytics.weekly_minutes.map(d => ({ day: d.day, planned: d.planned, actual: d.minutes }))} subjectHours={data.analytics.subject_hours.map(s => ({ name: s.name, value: s.hours, fill: s.color }))} />
    <div className="two-column"><Card><SectionLabel>Subject progress</SectionLabel>
      {!data.subjects.length && <p className="muted">Add subjects to see progress.</p>}
      {data.subjects.map(subject => {
        const ids = new Set(data.topics.filter(t => t.subject_id === subject.id).map(t => t.id))
        const sessions = data.sessions.filter(s => ids.has(s.topic_id) && s.status !== 'skipped')
        const completed = sessions.filter(s => s.status === 'done').length
        const percent = sessions.length ? Math.round(completed / sessions.length * 100) : 0
        return <div className="record" key={subject.id}><div style={{ width: '100%' }}><strong>{subject.name}</strong><p className="muted">{completed}/{sessions.length} sessions completed ({percent}%)</p><progress max={100} value={percent} aria-label={`${subject.name} session completion`} /></div></div>
      })}</Card><Card><SectionLabel>Topic difficulty distribution</SectionLabel>{Object.entries(data.analytics.topics_by_difficulty).map(([name, count]) => <div className="record" key={name}><span>{name}</span><strong>{count} topics</strong></div>)}<p className="muted">Synthetic training data. These predictions do not establish real-world accuracy or mastery.</p></Card></div>
  </div>
}
export function DashboardPage() {
  const { data } = useData()
  if (!data) return null
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return <div className="stack"><p>Your study snapshot, from your saved subjects, sessions and quiz results.</p>
    {data.topics.some(t => t.is_demo) && <p className="notice">Demo topics are included in these totals. They are labelled in Subjects.</p>}
    <Stats /><PlannerControls /><div className="two-column">
      <ExamCountdown exams={data.subjects.filter(s => s.exam_date && s.exam_date >= today).map(s => ({ id: String(s.id), subject: s.name, date: s.exam_date!, color: s.color }))} />
      <Sessions compact />
    </div><AnalyticsPanels />
  </div>
}
