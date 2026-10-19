import React, { useState } from 'react';
import RateChart from '../components/RateChart';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function HistoryPage({ historyRates = [], analytics }) {
  const [activeView, setActiveView] = useState('rate');
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
          <div className="view-toggle">
            <button
              className={`toggle-btn ${activeView === 'rate' ? 'active' : ''}`}
              onClick={() => setActiveView('rate')}
            >
              Exchange Rate
            </button>
            <button
              className={`toggle-btn ${activeView === 'volatility' ? 'active' : ''}`}
              onClick={() => setActiveView('volatility')}
            >
              Rolling Volatility
            </button>
          </div>
        </div>
      </div>

      {activeView === 'rate' ? (
        <RateChart rates={safeRates} title="USD/INR Exchange Rate Series (Levels)" height={380} />
      ) : (
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">30-Observation Rolling Volatility (Annualized %)</h3>
              <span className="chart-subtitle">
                Formula: Sample standard deviation of daily log returns over rolling 30 business sessions × √252 × 100
              </span>
            </div>
          </div>
          <div style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeRates.slice(-365)} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  minTickGap={40}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="chart-tooltip">
                        <div className="tooltip-date">{d.date}</div>
                        <div className="tooltip-rate">Annualized Vol: {d.annualized_volatility != null ? `${d.annualized_volatility}%` : '—'}</div>
                        <div className="tooltip-change">Std Dev: {d.rolling_volatility != null ? d.rolling_volatility : '—'}</div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="annualized_volatility"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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

