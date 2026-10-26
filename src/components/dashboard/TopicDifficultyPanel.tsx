import { AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, SectionLabel } from '../ui/Card'
import type { TopicDifficulty } from '../../types'

function getMasteryLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Strong',    color: '#7D9175', bg: '#EBF0EA' }
  if (score >= 60) return { label: 'Moderate',  color: '#C98BA6', bg: '#F8E9ED' }
  if (score >= 40) return { label: 'Needs work', color: '#A06070', bg: '#F2D5DC' }
  return              { label: 'Struggling',  color: '#8C3D52', bg: '#F5CDD8' }
}

interface TopicDifficultyProps {
  topics: TopicDifficulty[]
}

export function TopicDifficultyPanel({ topics }: TopicDifficultyProps) {
  const sorted = [...topics].sort((a, b) => a.score - b.score)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <SectionLabel>Topic mastery</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <AlertTriangle size={12} color="#DDA9BB" />
          <span style={{ fontSize: '0.68rem', color: '#DDA9BB', fontWeight: 500 }}>
            {sorted.filter(t => t.score < 50).length} topics need attention
          </span>
        </div>
      </div>

      <p style={{ fontSize: '0.7rem', color: '#B8A9AD', marginBottom: '1rem', marginTop: '0.15rem' }}>
        Sample mastery scores · ML model not yet connected
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {sorted.map((topic) => {
          const { label, color, bg } = getMasteryLabel(topic.score)
          return (
            <div key={topic.topic}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#633F50' }}>{topic.topic}</span>
                  <span style={{ fontSize: '0.68rem', color: '#B8A9AD', marginLeft: '0.4rem' }}>{topic.subject}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: bg,
                      color,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {label.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#633F50', width: '2.5rem', textAlign: 'right' }}>
                    {topic.score}%
                  </span>
                </div>
              </div>

              <div style={{ height: '5px', background: '#F8E9ED', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${topic.score}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '999px',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginTop: '1rem',
          padding: '0.5rem 0.75rem',
          background: '#EBF0EA',
          borderRadius: '8px',
        }}
      >
        <TrendingUp size={13} color="#7D9175" />
        <span style={{ fontSize: '0.7rem', color: '#7D9175', fontWeight: 500 }}>
          AI will prioritise low-mastery topics in future scheduling
        </span>
      </div>
    </Card>
  )
}
