import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'MAX', days: null },
];

export default function RateChart({ rates = [], title = 'USD/INR Historical Rate', showRangeSelector = true, height = 340 }) {
  const [selectedRange, setSelectedRange] = useState('1Y');

  // Filter rates by selected range
  const filteredData = useMemo(() => {
    if (!rates || rates.length === 0) return [];

    const rangeConfig = RANGES.find((r) => r.label === selectedRange);
    if (!rangeConfig || rangeConfig.days === null) {
      // For MAX, return downsampled data if over 600 points for smooth rendering
      if (rates.length > 600) {
        const step = Math.ceil(rates.length / 500);
        return rates.filter((_, idx) => idx % step === 0 || idx === rates.length - 1);
      }
      return rates;
    }

    const lastObs = rates[rates.length - 1];
    if (!lastObs?.date) return rates;

    const endDate = new Date(lastObs.date);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - rangeConfig.days);

    const startStr = startDate.toISOString().split('T')[0];
    return rates.filter((item) => item.date >= startStr);
  }, [rates, selectedRange]);

  // Compute min/max for tight Y-axis domain
  const { minY, maxY } = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { minY: 0, maxY: 100 };
    const values = filteredData.map((d) => d.rate).filter(Boolean);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.08 || 1;
    return {
      minY: Math.floor((min - padding) * 10) / 10,
      maxY: Math.ceil((max + padding) * 10) / 10,
    };
  }, [filteredData]);

  if (!rates || rates.length === 0) {
    return (
      <div className="chart-card empty-chart" style={{ height }}>
        <p>No historical rate data available.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3 className="chart-title">{title}</h3>
          <span className="chart-count">{filteredData.length} observations</span>
        </div>
        {showRangeSelector && (
          <div className="range-selector">
            {RANGES.map((r) => (
              <button
                key={r.label}
                className={`range-btn ${selectedRange === r.label ? 'active' : ''}`}
                onClick={() => setSelectedRange(r.label)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val) => {
                if (!val) return '';
                const parts = val.split('-');
                if (selectedRange === '1M' || selectedRange === '3M') return `${parts[1]}/${parts[2]}`;
                return `${parts[0]}-${parts[1]}`;
              }}
              minTickGap={40}
            />
            <YAxis
              domain={[minY, maxY]}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `₹${v.toFixed(1)}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="chart-tooltip">
                    <div className="tooltip-date">{d.date}</div>
                    <div className="tooltip-rate">₹{Number(d.rate).toFixed(4)}</div>
                    {d.abs_change !== undefined && (
                      <div
                        className="tooltip-change"
                        style={{
                          color: d.abs_change > 0 ? '#d97706' : d.abs_change < 0 ? '#16a34a' : '#64748b',
                        }}
                      >
                        {d.abs_change > 0 ? '▲ +' : d.abs_change < 0 ? '▼ ' : '• '}
                        {d.abs_change.toFixed(4)} ({d.pct_change > 0 ? '+' : ''}{Number(d.pct_change).toFixed(2)}%)
                      </div>
                    )}
                    {d.annualized_volatility && (
                      <div className="tooltip-vol">Vol (30d): {d.annualized_volatility}%</div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#2563eb"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#rateGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
