import React from 'react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'converter', label: 'Converter' },
  { id: 'history', label: 'History & Analytics' },
  { id: 'forecasts', label: 'Nowcast & Forecast' },
  { id: 'methodology', label: 'Methodology' },
];

export default function AppShell({
  activeTab,
  onTabChange,
  dataStatus,
  lastFetched,
  lastObsDate,
  onRefresh,
  isRefreshing,
  children,
}) {
  const isStale = dataStatus === 'stale';
  const isUnavailable = dataStatus === 'unavailable';
  const statusLabel = {
    loading: 'Connecting to rates service',
    unavailable: 'Rates service unavailable',
    stale: 'Cached rates (stale)',
    cache: 'Reference rates available',
    fresh: 'Reference rates available',
    live: 'Reference rates available',
  }[dataStatus] || 'Rates status unknown';

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-container">
          <div className="header-left">
            <div className="brand">
              <span className="logo">CurLens</span>
              <span className="tagline">Rupee Lens (USD/INR)</span>
            </div>
            <div className="pair-badge">USD/INR</div>
          </div>

          <div className="header-right">
            <div className="status-indicator">
              <span
                className="status-dot"
                style={{
                  backgroundColor: isUnavailable ? '#dc2626' : isStale ? '#f59e0b' : dataStatus === 'loading' ? '#94a3b8' : '#10b981',
                }}
              />
              <span className="status-text">
                {statusLabel}
              </span>
              {lastObsDate && <span className="obs-date">Obs: {lastObsDate}</span>}
            </div>

            <button
              className="refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh latest rates from Frankfurter API"
            >
              {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        <nav className="nav-bar">
          <div className="nav-container">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-text">
            <strong>CurLens (Rupee Lens)</strong> — Reference Currency Analytics & Forecasts.
          </div>
          <div className="footer-disclaimer">
            Rates provided by <a href="https://frankfurter.dev" target="_blank" rel="noreferrer">Frankfurter API v2</a> (European Central Bank daily reference rates). Rates update once per business day and are not live trading quotes. Statistical estimates are strictly for educational and analytical purposes.
          </div>
          {lastFetched && (
            <div className="footer-timestamp">Last updated: {lastFetched}</div>
          )}
        </div>
      </footer>
    </div>
  );
}

