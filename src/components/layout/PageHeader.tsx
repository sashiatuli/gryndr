interface PageHeaderProps { title: string; subtitle?: string; query: string; onSearch: (query: string) => void }
export function PageHeader({ title, subtitle, query, onSearch }: PageHeaderProps) {
  return <header className="page-header"><div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
    <label className="header-search">Search topics<input type="search" placeholder="Topic or subject name" value={query} onChange={e => onSearch(e.target.value)} /></label>
  </header>
}
