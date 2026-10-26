import { useState, useEffect } from 'react'
import { Clock, BookMarked } from 'lucide-react'
import { Card, SectionLabel } from '../ui/Card'
import type { Exam } from '../../types'

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86_400_000))
}

interface ExamCountdownProps {
  exams: Exam[]
}

export function ExamCountdown({ exams }: ExamCountdownProps) {
  const [tick, setTick] = useState(0)

  // Lightweight ticking so the component feels alive
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const sorted = [...exams].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const primary = sorted[0]
  if (!primary) return <Card><SectionLabel>Upcoming exams</SectionLabel><p className="muted">No upcoming exams. Add an exam date when creating a subject.</p></Card>
  const daysLeft = getDaysUntil(primary.date)

  return (
    <Card>
      <SectionLabel>Upcoming exams</SectionLabel>

      {/* Primary countdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: `${primary.color}22`,
            border: `2px solid ${primary.color}55`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: '"DM Serif Display", serif',
              fontSize: '1.6rem',
              color: primary.color,
              lineHeight: 1,
            }}
          >
            {daysLeft}
          </span>
          <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#B8A9AD', letterSpacing: '0.06em' }}>
            DAYS
          </span>
        </div>

        <div>
          <p style={{ fontWeight: 600, color: '#633F50', fontSize: '0.9rem', lineHeight: 1.3 }}>
            {primary.subject}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#B8A9AD', marginTop: '0.15rem' }}>
            {new Date(primary.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div style={{ marginTop: '0.5rem', background: '#F8E9ED', borderRadius: '4px', height: '4px', width: '100%' }}>
            <div
              style={{
                width: `${Math.max(4, 100 - (daysLeft / 60) * 100)}%`,
                height: '100%',
                background: primary.color,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Other exams list */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sorted.slice(1).map(exam => (
          <div
            key={exam.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: '#FFF9F6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: exam.color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.8rem', color: '#633F50', fontWeight: 500 }}>{exam.subject}</p>
                <p style={{ fontSize: '0.7rem', color: '#B8A9AD' }}>
                  {new Date(exam.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#8A5C70' }}>
              <Clock size={12} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{getDaysUntil(exam.date)}d</span>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder note */}
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <BookMarked size={12} color="#DDA9BB" />
        <span style={{ fontSize: '0.68rem', color: '#B8A9AD' }}>Exam dates from your subjects</span>
      </div>

      {/* Suppress unused warning */}
      <span style={{ display: 'none' }}>{tick}</span>
    </Card>
  )
}
