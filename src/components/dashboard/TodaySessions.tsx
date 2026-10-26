import { CheckCircle2, Circle, Play, Flame } from 'lucide-react'
import { Card, SectionLabel } from '../ui/Card'
import type { Session } from '../../types'

const STATUS_CONFIG = {
  done:     { icon: CheckCircle2, color: '#A7B5A0', label: 'Done',    bg: '#EBF0EA' },
  active:   { icon: Play,         color: '#DDA9BB', label: 'Active',  bg: '#F8E9ED' },
  upcoming: { icon: Circle,       color: '#B8A9AD', label: 'Up next', bg: '#F4EFEF' },
}

interface TodaySessionsProps {
  sessions: Session[]
}

export function TodaySessions({ sessions }: TodaySessionsProps) {
  const done = sessions.filter(s => s.status === 'done').length
  const total = sessions.length
  const minutesStudied = sessions
    .filter(s => s.status === 'done')
    .reduce((acc, s) => acc + s.duration, 0)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <SectionLabel>Today&apos;s sessions</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '-0.1rem' }}>
          <Flame size={13} color="#DDA9BB" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#DDA9BB' }}>
            {minutesStudied} min studied
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.6rem 0 1rem' }}>
        <div
          style={{
            flex: 1,
            height: '5px',
            background: '#F8E9ED',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(done / total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #DDA9BB, #C98BA6)',
              borderRadius: '999px',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8A5C70', whiteSpace: 'nowrap' }}>
          {done}/{total}
        </span>
      </div>

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sessions.map(session => {
          const { icon: Icon, color, bg } = STATUS_CONFIG[session.status]
          return (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: session.status === 'active' ? '#FFF0F4' : '#FFF9F6',
                border: session.status === 'active' ? '1px solid #F2D5DC' : '1px solid transparent',
                transition: 'all 0.15s ease',
                opacity: session.status === 'done' ? 0.7 : 1,
              }}
            >
              <Icon size={16} color={color} strokeWidth={2} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#633F50',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textDecoration: session.status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {session.topic}
                </p>
                <p style={{ fontSize: '0.7rem', color: '#B8A9AD', marginTop: '0.05rem' }}>
                  {session.subject} · {session.duration} min
                </p>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8A5C70' }}>
                  {session.time}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: color,
                    background: bg,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    marginTop: '0.15rem',
                    textAlign: 'center',
                  }}
                >
                  {STATUS_CONFIG[session.status].label.toUpperCase()}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.68rem', color: '#B8A9AD', marginTop: '0.75rem' }}>
        ✦ Sessions are sample placeholders · AI scheduling not yet connected
      </p>
    </Card>
  )
}
