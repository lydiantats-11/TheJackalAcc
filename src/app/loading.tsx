/** Loading state shown while a page's data loads (skeleton cards, no layout shift). */
export default function Loading() {
  return (
    <div className="container" aria-busy="true" aria-live="polite">
      <div className="page-head">
        <div className="skeleton" style={{ height: 34, width: "40%", marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 18, width: "65%" }} />
      </div>
      <div className="opp-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="opp-card">
            <div className="skeleton" style={{ height: 18, width: "50%" }} />
            <div className="skeleton" style={{ height: 22, width: "90%" }} />
            <div className="skeleton" style={{ height: 14, width: "60%" }} />
            <div className="skeleton" style={{ height: 40, width: "100%" }} />
          </div>
        ))}
      </div>
      <span className="visually-hidden">Φόρτωση… / Loading…</span>
    </div>
  );
}
