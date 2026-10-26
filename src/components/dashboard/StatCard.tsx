import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  accent?: string
  children?: ReactNode
}

export function StatCard({ icon: Icon, label, value, sub, accent = '#DDA9BB', children }: StatCardProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '1rem 1.15rem',
        boxShadow: '0 2px 12px rgba(99,63,80,0.06)',
        border: '1px solid rgba(221,169,187,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: `${accent}1A`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={17} color={accent} strokeWidth={1.9} />
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', color: '#B8A9AD', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>

      <div>
        <p style={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.55rem', color: '#633F50', lineHeight: 1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: '0.7rem', color: '#B8A9AD', marginTop: '0.2rem' }}>{sub}</p>}
      </div>

      {children}
    </div>
  )
}
