import { Calendar, Zap, Heart, Sparkles, ChevronRight, Info } from 'lucide-react'
import { Card, SectionLabel, PlaceholderBanner } from '../ui/Card'
import type { AISuggestion } from '../../types'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  calendar: Calendar,
  zap:      Zap,
  heart:    Heart,
}

const TYPE_STYLE: Record<string, { accent: string; bg: string }> = {
  reschedule: { accent: '#DDA9BB', bg: '#FFF0F4' },
  difficulty: { accent: '#C98BA6', bg: '#FAE8F0' },
  wellbeing:  { accent: '#A7B5A0', bg: '#EBF0EA' },
}

interface AIPlannerPanelProps {
  suggestions: AISuggestion[]
}

export function AIPlannerPanel({ suggestions }: AIPlannerPanelProps) {
  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <SectionLabel>AI planner</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
            <Sparkles size={14} color="#DDA9BB" />
            <h2
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: '1.1rem',
                color: '#633F50',
                fontWeight: 400,
              }}
            >
              Insights &amp; suggestions
            </h2>
          </div>
        </div>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F8E9ED, #F2D5DC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={16} color="#C98BA6" />
        </div>
      </div>

      {/* Placeholder status banner */}
      <div style={{ marginTop: '1rem' }}>
        <PlaceholderBanner
          label="AI Coach · not yet connected"
          description="These are sample suggestions. Agentic AI will power this panel in a future milestone."
        />
      </div>

      {/* Suggestion cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
        {suggestions.map(s => {
          const Icon = ICON_MAP[s.icon] ?? Sparkles
          const { accent, bg } = TYPE_STYLE[s.type]
          return (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.8rem 0.9rem',
                borderRadius: '12px',
                background: bg,
                border: `1px solid ${accent}33`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,63,80,0.1)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
              }}
            >
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: `${accent}22`,
                  border: `1px solid ${accent}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={14} color={accent} strokeWidth={2} />
              </div>

              <p style={{ fontSize: '0.78rem', color: '#633F50', lineHeight: 1.5, flex: 1 }}>
                {s.message}
              </p>

              <ChevronRight size={14} color="#B8A9AD" style={{ flexShrink: 0, marginTop: '2px' }} />
            </div>
          )
        })}
      </div>

      {/* Capability roadmap note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#FFF9F6',
          borderRadius: '10px',
          border: '1px solid rgba(221,169,187,0.2)',
        }}
      >
        <Info size={13} color="#B8A9AD" style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ fontSize: '0.7rem', color: '#B8A9AD', lineHeight: 1.5 }}>
          Future capabilities: adaptive scheduling, spaced-repetition recommendations, fatigue detection,
          and agentic rescheduling on exam changes.
        </p>
      </div>
    </Card>
  )
}
