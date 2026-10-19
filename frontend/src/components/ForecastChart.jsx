import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function ForecastChart({ recentHistory = [], forecastHorizons = [], height = 360 }) {
  const chartData = useMemo(() => {
    const data = [];

    const safeHistory = Array.isArray(recentHistory)
      ? recentHistory.filter((item) => item?.rate != null && Number.isFinite(Number(item.rate)))
      : [];
    const historySlice = safeHistory.slice(-15);
    historySlice.forEach((item) => {
      data.push({
        label: item.date,
        isForecast: false,
        actual: Number(item.rate),
        baseline: null,
        arima: null,
        lower_80: null,
        upper_80: null,
        lower_95: null,
        upper_95: null,
      });
    });

    const horizons = Array.isArray(forecastHorizons)
      ? forecastHorizons.filter((item) => item && typeof item === 'object')
      : [];
    if (historySlice.length === 0 || horizons.length === 0) {
      return data;
    }

    const lastObsRate = Number(historySlice[historySlice.length - 1].rate);

    const lastItem = data[data.length - 1];
    if (lastItem) {
      lastItem.baseline = lastObsRate;
      lastItem.arima = lastObsRate;
      lastItem.lower_80 = lastObsRate;
      lastItem.upper_80 = lastObsRate;
      lastItem.lower_95 = lastObsRate;
      lastItem.upper_95 = lastObsRate;
    }

    horizons.forEach((h, idx) => {
      const hNum = h.horizon_observations || idx + 1;
      const basePred = h.baseline?.prediction != null ? Number(h.baseline.prediction) : null;
      const arimaPred = h.arima?.prediction != null ? Number(h.arima.prediction) : null;
      const l80 = h.arima?.lower_80 != null ? Number(h.arima.lower_80) : null;
      const u80 = h.arima?.upper_80 != null ? Number(h.arima.upper_80) : null;
      const l95 = h.arima?.lower_95 != null ? Number(h.arima.lower_95) : null;
      const u95 = h.arima?.upper_95 != null ? Number(h.arima.upper_95) : null;

      data.push({
        label: `+${hNum} obs`,
        isForecast: true,
        actual: null,
        baseline: basePred,
        arima: arimaPred,
        lower_80: l80,
        upper_80: u80,
        lower_95: l95,
        upper_95: u95,
      });
    });

    return data;
  }, [recentHistory, forecastHorizons]);

  const { minY, maxY } = useMemo(() => {
    if (!chartData || chartData.length === 0) return { minY: 0, maxY: 100 };
    const allValues = [];
    chartData.forEach((d) => {
      ['actual', 'baseline', 'arima', 'lower_95', 'upper_95'].forEach((key) => {
        if (typeof d[key] === 'number' && Number.isFinite(d[key])) allValues.push(d[key]);
      });
    });
    if (allValues.length === 0) return { minY: 80, maxY: 100 };
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.12 || 1;
    return {
      minY: Math.floor((min - pad) * 10) / 10,
      maxY: Math.ceil((max + pad) * 10) / 10,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="chart-card empty-chart" style={{ minHeight: height }}>
        <p>Forecast chart data is not available yet.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Observed History & Forward Forecasts</h3>
          <span className="chart-subtitle">
            Recent daily reference rates with 1, 3, and 5-observation forward models
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
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
                    <div className="tooltip-date">
                      {d.isForecast ? `Forecast Horizon (${d.label})` : `Observed: ${d.label}`}
                    </div>
                    {typeof d.actual === 'number' && !isNaN(d.actual) && <div className="tooltip-actual">Observed: ₹{d.actual.toFixed(4)}</div>}
                    {typeof d.arima === 'number' && !isNaN(d.arima) && <div className="tooltip-arima">ARIMA Estimate: ₹{d.arima.toFixed(4)}</div>}
                    {typeof d.baseline === 'number' && !isNaN(d.baseline) && <div className="tooltip-baseline">Random Walk: ₹{d.baseline.toFixed(4)}</div>}
                    {typeof d.lower_80 === 'number' && typeof d.upper_80 === 'number' && (
                      <div className="tooltip-intervals">
                        <div>80% CI: [₹{d.lower_80.toFixed(2)}, ₹{d.upper_80.toFixed(2)}]</div>
                        {typeof d.lower_95 === 'number' && typeof d.upper_95 === 'number' && (
                          <div>95% CI: [₹{d.lower_95.toFixed(2)}, ₹{d.upper_95.toFixed(2)}]</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="plainline"
              formatter={(value) => {
                const labels = {
                  actual: 'Observed Reference Rate',
                  arima: 'ARIMA Forecast',
                  baseline: 'Random Walk Baseline',
                  upper_95: '95% Prediction Interval',
                  upper_80: '80% Prediction Interval',
                };
                return <span style={{ fontSize: '0.8125rem', color: '#334155' }}>{labels[value] || value}</span>;
              }}
            />

            <Area
              type="monotone"
              dataKey="upper_95"
              stroke="none"
              fill="#bfdbfe"
              fillOpacity={0.35}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="upper_80"
              stroke="none"
              fill="#93c5fd"
              fillOpacity={0.45}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#0f172a"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0f172a' }}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="baseline"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#94a3b8' }}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="arima"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#2563eb' }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="forecast-disclaimer">
        * <strong>Observation Steps:</strong> Forecast horizons (+1, +3, +5 obs) represent sequential daily published observations (business days), not calendar dates. Frankfurter published daily reference rates; intervals reflect statistical variance on log returns.
      </div>
    </div>
  );
}

