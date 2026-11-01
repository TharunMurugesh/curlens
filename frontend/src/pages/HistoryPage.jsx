import React from 'react';
import ChartStudio from '../components/ChartStudio';

export default function HistoryPage({ historyRates = [], analytics }) {
  const safeRates = Array.isArray(historyRates) ? historyRates : [];
  const recentRates = safeRates.slice(-20).reverse();

  return (
    <div className="history-page">
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h2 className="page-title">USD/INR History & Analytics</h2>
            <p className="page-description">
              Daily published reference rates{analytics?.start_date && analytics?.end_date ? ` from ${analytics.start_date} to ${analytics.end_date}` : ' across the available observation period'}.
            </p>
          </div>
        </div>
      </div>

      <ChartStudio rates={safeRates} />

      <div className="summary-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Observations</span>
          <span className="stat-value">{analytics?.observation_count != null ? Number(analytics.observation_count).toLocaleString() : '—'}</span>
          <span className="stat-hint">Excludes weekend/holiday gaps</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Period Minimum</span>
          <span className="stat-value">{analytics?.period_min != null ? `₹${Number(analytics.period_min).toFixed(2)}` : '—'}</span>
          <span className="stat-hint">Strongest rupee level</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Period Maximum</span>
          <span className="stat-value">{analytics?.period_max != null ? `₹${Number(analytics.period_max).toFixed(2)}` : '—'}</span>
          <span className="stat-hint">Weakest rupee level</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Historical Mean</span>
          <span className="stat-value">{analytics?.period_mean != null ? `₹${Number(analytics.period_mean).toFixed(2)}` : '—'}</span>
          <span className="stat-hint">Period average</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Historical Median</span>
          <span className="stat-value">{analytics?.period_median != null ? `₹${Number(analytics.period_median).toFixed(2)}` : '—'}</span>
          <span className="stat-hint">50th percentile rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latest 30d Volatility</span>
          <span className="stat-value">{analytics?.latest_annualized_volatility != null ? `${analytics.latest_annualized_volatility}%` : '—'}</span>
          <span className="stat-hint">Annualized rate volatility</span>
        </div>
      </div>

      <div className="table-card">
        <h3 className="table-title">Recent Daily Observations</h3>
        <span className="table-subtitle">Showing latest 20 published sessions with daily metrics</span>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rate (USD/INR)</th>
                <th>Daily Change</th>
                <th>Percentage</th>
                <th>Annualized Vol</th>
              </tr>
            </thead>
            <tbody>
              {recentRates.map((r) => {
                const isPos = typeof r.abs_change === 'number' && r.abs_change > 0;
                const isNeg = typeof r.abs_change === 'number' && r.abs_change < 0;
                return (
                  <tr key={r.date}>
                    <td className="date-col"><strong>{r.date}</strong></td>
                    <td className="rate-col">{r.rate != null ? `₹${Number(r.rate).toFixed(4)}` : '—'}</td>
                    <td style={{ color: isPos ? '#d97706' : isNeg ? '#16a34a' : '#64748b' }}>
                      {isPos ? '▲ +' : isNeg ? '▼ ' : '• '}
                      {typeof r.abs_change === 'number' ? r.abs_change.toFixed(4) : '—'}
                    </td>
                    <td style={{ color: isPos ? '#d97706' : isNeg ? '#16a34a' : '#64748b' }}>
                      {typeof r.pct_change === 'number' ? `${isPos ? '+' : ''}${r.pct_change.toFixed(2)}%` : '—'}
                    </td>
                    <td>{r.annualized_volatility != null ? `${r.annualized_volatility}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

