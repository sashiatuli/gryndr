import type { LucideIcon } from 'lucide-react'
import { PlaceholderBanner } from '../components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
  milestone: string
}

export function PlaceholderPage({ title, description, icon: Icon, milestone }: PlaceholderPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #F8E9ED, #F2D5DC)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={30} color="#DDA9BB" strokeWidth={1.5} />
      </div>

      <div>
        <h2
          style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: '1.4rem',
            color: '#633F50',
            marginBottom: '0.5rem',
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#B8A9AD', lineHeight: 1.6 }}>{description}</p>
      </div>

      <PlaceholderBanner
        label={`Coming in ${milestone}`}
        description="This page will be built in a future milestone."
      />
    </div>
  )
}
