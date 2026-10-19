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
  const [activeView, setActiveView] = useState('rate'); // 'rate' or 'volatility'

  const recentRates = historyRates.slice(-20).reverse();

  return (
    <div className="history-page">
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h2 className="page-title">USD/INR History & Analytics</h2>
            <p className="page-description">
              Daily published reference exchange rates spanning {analytics?.start_date || '2015'} to {analytics?.end_date || '2026'}.
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

      {/* Main Chart */}
      {activeView === 'rate' ? (
        <RateChart rates={historyRates} title="USD/INR Exchange Rate Series (Levels)" height={380} />
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
              <LineChart data={historyRates.slice(-365)} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
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
                        <div className="tooltip-rate">Annualized Vol: {d.annualized_volatility}%</div>
                        <div className="tooltip-change">Std Dev: {d.rolling_volatility}</div>
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

      {/* Statistical Summary Grid */}
      <div className="summary-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Observations</span>
          <span className="stat-value">{analytics?.observation_count?.toLocaleString() || '—'}</span>
          <span className="stat-hint">Excludes weekend/holiday gaps</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Period Minimum</span>
          <span className="stat-value">₹{analytics?.period_min?.toFixed(2) || '—'}</span>
          <span className="stat-hint">Strongest rupee level</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Period Maximum</span>
          <span className="stat-value">₹{analytics?.period_max?.toFixed(2) || '—'}</span>
          <span className="stat-hint">Weakest rupee level</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Historical Mean</span>
          <span className="stat-value">₹{analytics?.period_mean?.toFixed(2) || '—'}</span>
          <span className="stat-hint">Period average</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Historical Median</span>
          <span className="stat-value">₹{analytics?.period_median?.toFixed(2) || '—'}</span>
          <span className="stat-hint">50th percentile rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latest 30d Volatility</span>
          <span className="stat-value">{analytics?.latest_annualized_volatility}%</span>
          <span className="stat-hint">Annualized rate volatility</span>
        </div>
      </div>

      {/* Recent Observations Table */}
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
                const isPos = r.abs_change > 0;
                const isNeg = r.abs_change < 0;
                return (
                  <tr key={r.date}>
                    <td className="date-col"><strong>{r.date}</strong></td>
                    <td className="rate-col">₹{Number(r.rate).toFixed(4)}</td>
                    <td style={{ color: isPos ? '#d97706' : isNeg ? '#16a34a' : '#64748b' }}>
                      {isPos ? '▲ +' : isNeg ? '▼ ' : '• '}
                      {r.abs_change !== undefined ? r.abs_change.toFixed(4) : '—'}
                    </td>
                    <td style={{ color: isPos ? '#d97706' : isNeg ? '#16a34a' : '#64748b' }}>
                      {r.pct_change !== undefined ? `${isPos ? '+' : ''}${r.pct_change.toFixed(2)}%` : '—'}
                    </td>
                    <td>{r.annualized_volatility ? `${r.annualized_volatility}%` : '—'}</td>
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
