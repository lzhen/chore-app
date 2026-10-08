import { Logo } from './Logo';

/** Visual-only loading states: the owning auth/data providers control their lifetime. */
export function LoadingScreen({ phase }: { phase: 'session' | 'chores' }) {
  const label = phase === 'session' ? 'Opening Nesmi…' : 'Loading your chores…';
  if (phase === 'session') {
    return <main className="nesmi-startup" aria-busy="true">
      <div className="nesmi-startup-brand"><Logo size="md" />
        <div className="nesmi-loading-line" aria-hidden="true"><span /></div>
        <p role="status" aria-live="polite">{label}</p>
      </div>
    </main>;
  }
  return <main className="nesmi-loading-shell" aria-busy="true">
    <p className="sr-only" role="status" aria-live="polite">{label}</p>
    <header className="chore-header" aria-hidden="true"><div className="chore-brand"><Logo size="sm" /><span className="chore-brand-byline">by Empathie</span></div></header>
    <div className="nesmi-loading-layout" aria-hidden="true">
      <aside className="nesmi-loading-sidebar">{Array.from({length:5},(_,i)=><span key={i} className="nesmi-skeleton" />)}</aside>
      <section className="nesmi-loading-content">
        <div className="nesmi-loading-content-inner">
          <span className="nesmi-skeleton nesmi-skeleton-eyebrow" />
          <span className="nesmi-skeleton nesmi-skeleton-title" />
          <div className="nesmi-loading-summary"><span className="nesmi-skeleton"/><span className="nesmi-skeleton"/></div>
          <div className="nesmi-loading-week">{Array.from({length:7},(_,i)=><span key={i} className="nesmi-skeleton" />)}</div>
          {Array.from({length:4},(_,i)=><div className="nesmi-loading-row" key={i}><span className="nesmi-skeleton-check"/><div><span className="nesmi-skeleton nesmi-skeleton-task"/><span className="nesmi-skeleton nesmi-skeleton-meta"/></div></div>)}
        </div>
      </section>
    </div>
  </main>;
}
