import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, SectionLabel } from '../ui/Card'
import type { WeeklyProgress, SubjectHours } from '../../types'

// ── Custom Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(221,169,187,0.3)',
        borderRadius: '10px',
        padding: '0.5rem 0.85rem',
        boxShadow: '0 4px 16px rgba(99,63,80,0.1)',
        fontSize: '0.75rem',
        color: '#633F50',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value} min</strong>
        </p>
      ))}
    </div>
  )
}

interface StudyProgressProps {
  weeklyProgress: WeeklyProgress[]
  subjectHours: SubjectHours[]
}

export function StudyProgress({ weeklyProgress, subjectHours }: StudyProgressProps) {
  const totalHours = subjectHours.reduce((a, s) => a + s.value, 0)

  return (
    <Card>
      <SectionLabel>Study progress</SectionLabel>
      <p style={{ fontSize: '0.7rem', color: '#B8A9AD', marginBottom: '1.25rem', marginTop: '0.1rem' }}>
        Last 7 days (UTC) - recorded study minutes
      </p>

      <div className="two-column">
        {/* Bar chart */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8A5C70', marginBottom: '0.75rem' }}>
            Daily minutes (planned vs actual)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyProgress} barCategoryGap="30%" barGap={3}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#B8A9AD', fontFamily: 'DM Sans' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8E9ED' }} />
              <Bar dataKey="planned" name="Planned" fill="#F2D5DC" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual"  name="Actual"  fill="#DDA9BB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
            {[{ color: '#F2D5DC', label: 'Planned' }, { color: '#DDA9BB', label: 'Actual' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
                <span style={{ fontSize: '0.68rem', color: '#B8A9AD' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie / donut chart */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8A5C70', marginBottom: '0.75rem', textAlign: 'center' }}>
            Completed study time by subject (all time)
          </p>
          <div style={{ position: 'relative', width: 130, height: 130 }}>
            <PieChart width={130} height={130}>
              <Pie
                data={subjectHours}
                cx={60}
                cy={60}
                innerRadius={38}
                outerRadius={58}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {subjectHours.map(entry => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
            {/* Centre label */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#633F50', display: 'block', lineHeight: 1 }}>
                {totalHours.toFixed(1)}h
              </span>
              <span style={{ fontSize: '0.6rem', color: '#B8A9AD' }}>total</span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem', marginTop: '0.5rem' }}>
            {subjectHours.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.fill, flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: '#8A5C70' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
