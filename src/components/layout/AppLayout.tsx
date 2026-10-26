import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { PageHeader } from './PageHeader'

interface AppLayoutProps {
  children: ReactNode
  activePage: string
  onNavigate: (id: string) => void
  pageTitle: string
  pageSubtitle?: string
  query: string
  onSearch: (query: string) => void
}

export function AppLayout({
  children,
  activePage,
  onNavigate,
  pageTitle,
  pageSubtitle,
  query,
  onSearch,
}: AppLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: '#FFF9F6' }}>
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <PageHeader title={pageTitle} subtitle={pageSubtitle} query={query} onSearch={onSearch} />

        <main
          style={{
            flex: 1,
            padding: '1.75rem 2rem',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
