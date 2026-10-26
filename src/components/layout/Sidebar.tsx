import { useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  BarChart2,
  Sparkles,
  Settings,
  ChevronLeft,
  GraduationCap,
  Menu,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, href: '#' },
  { id: 'planner',   label: 'Planner',    icon: CalendarDays,    href: '#' },
  { id: 'subjects',  label: 'Subjects',   icon: BookOpen,        href: '#' },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2,       href: '#' },
  { id: 'ai',        label: 'AI Coach',   icon: Sparkles,        href: '#' },
]

interface SidebarProps {
  activePage: string
  onNavigate: (id: string) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className="sidebar"
      style={{
        width: collapsed ? '68px' : '220px',
        minHeight: '100vh',
        background: '#FFFFFF',
        borderRight: '1px solid rgba(221, 169, 187, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '1.25rem 0' : '1.5rem 1.25rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(221, 169, 187, 0.15)',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #DDA9BB 0%, #C98BA6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={18} color="#fff" />
        </div>
        {!collapsed && (
          <div>
            <span
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: '1.2rem',
                color: '#633F50',
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              gryndr
            </span>
            <span style={{ fontSize: '0.6rem', color: '#DDA9BB', letterSpacing: '0.1em', fontWeight: 600 }}>
              STUDY PLANNER
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
          const isActive = activePage === id
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              id={`nav-${id}`}
              onClick={(e) => { e.preventDefault(); onNavigate(id) }}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: collapsed ? '0.75rem 0' : '0.7rem 1.25rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '0.1rem 0.5rem',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                background: isActive ? 'linear-gradient(135deg, #F8E9ED, #F2D5DC)' : 'transparent',
                color: isActive ? '#633F50' : '#8A5C70',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.background = '#FFF9F6'
                  ;(e.currentTarget as HTMLElement).style.color = '#633F50'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#8A5C70'
                }
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && isActive && (
                <div
                  style={{
                    position: 'absolute',
                    right: '-0.5rem',
                    width: '3px',
                    height: '60%',
                    background: '#DDA9BB',
                    borderRadius: '999px',
                  }}
                />
              )}
            </a>
          )
        })}
      </nav>

      {/* Bottom: Settings + collapse toggle */}
      <div style={{ borderTop: '1px solid rgba(221, 169, 187, 0.15)', padding: '0.75rem 0' }}>
        <a
          href="#settings"
          onClick={(e) => { e.preventDefault(); onNavigate('settings') }}
          title="Settings"
          aria-current={activePage === 'settings' ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: collapsed ? '0.7rem 0' : '0.7rem 1.25rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            margin: '0 0.5rem',
            borderRadius: '10px',
            textDecoration: 'none',
            color: '#8A5C70',
            fontSize: '0.875rem',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#FFF9F6')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <Settings size={18} strokeWidth={1.8} />
          {!collapsed && <span>Settings</span>}
        </a>

        <button
          id="btn-collapse-sidebar"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#B8A9AD',
            marginTop: '0.25rem',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#633F50')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#B8A9AD')}
        >
          {collapsed
            ? <Menu size={16} />
            : <ChevronLeft size={16} />
          }
        </button>
      </div>
    </aside>
  )
}
