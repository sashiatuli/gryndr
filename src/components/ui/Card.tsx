import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        boxShadow: '0 2px 16px 0 rgba(99, 63, 80, 0.07)',
        border: '1px solid rgba(221, 169, 187, 0.15)',
        padding: '1.25rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface SectionLabelProps {
  children: ReactNode
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#DDA9BB',
        display: 'block',
        marginBottom: '0.25rem',
      }}
    >
      {children}
    </span>
  )
}

interface BadgeProps {
  children: ReactNode
  variant?: 'pink' | 'sage' | 'plum' | 'neutral'
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const styles: Record<string, React.CSSProperties> = {
    pink:    { background: '#F8E9ED', color: '#C98BA6' },
    sage:    { background: '#EBF0EA', color: '#7D9175' },
    plum:    { background: '#EDE5E8', color: '#633F50' },
    neutral: { background: '#F4EFEF', color: '#8A5C70' },
  }

  return (
    <span
      style={{
        ...styles[variant],
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        display: 'inline-block',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
}

interface PlaceholderBannerProps {
  label: string
  description?: string
}

export function PlaceholderBanner({ label, description }: PlaceholderBannerProps) {
  return (
    <div
      style={{
        background: 'repeating-linear-gradient(45deg, #FFF9F6, #FFF9F6 10px, #F8E9ED 10px, #F8E9ED 20px)',
        border: '1.5px dashed #DDA9BB',
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#DDA9BB',
          flexShrink: 0,
        }}
      />
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C98BA6', marginBottom: '0.1rem' }}>
          {label}
        </p>
        {description && (
          <p style={{ fontSize: '0.7rem', color: '#B8A9AD' }}>{description}</p>
        )}
      </div>
    </div>
  )
}
