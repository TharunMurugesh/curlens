import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_TYPES = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'bar', label: 'Bar' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'composed', label: 'Combo' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
  { value: 'radar', label: 'Radar' },
];

const METRICS = [
  { value: 'rate', label: 'Exchange rate', color: '#2563eb', format: (v) => `₹${Number(v).toFixed(4)}` },
  { value: 'abs_change', label: 'Daily change', color: '#d97706', format: (v) => Number(v).toFixed(4) },
  { value: 'pct_change', label: 'Daily change %', color: '#7c3aed', format: (v) => `${Number(v).toFixed(2)}%` },
  { value: 'annualized_volatility', label: 'Annualized volatility', color: '#0891b2', format: (v) => `${Number(v).toFixed(2)}%` },
];

const COLORS = ['#2563eb', '#7c3aed', '#d97706', '#0891b2', '#16a34a', '#db2777'];
const STORAGE_KEY = 'curlens-chart-studio-v1';

function makeChart(type = 'line', metric = 'rate') {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, metric };
}

function initialCharts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    return [makeChart('line'), makeChart('area'), makeChart('bar', 'pct_change'), makeChart('composed', 'rate')];
  }
  return [makeChart('line'), makeChart('area'), makeChart('bar', 'pct_change'), makeChart('composed', 'rate')];
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ChartContent({ chart, data, metric, id }) {
  const color = metric.color;
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />;
  const xAxis = <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={35} />;
  const yAxis = <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} width={62} />;
  const tooltip = <Tooltip formatter={(value, name) => name === 'pct_change' ? `${Number(value).toFixed(2)}%` : metric.format(value)} labelStyle={{ color: '#334155' }} contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }} />;

  if (chart.type === 'pie' || chart.type === 'donut') {
    const values = data.filter((item) => item[chart.metric] != null);
    const low = Math.min(...values.map((item) => item[chart.metric]));
    const high = Math.max(...values.map((item) => item[chart.metric]));
    const bins = Array.from({ length: 5 }, (_, index) => ({ name: `Band ${index + 1}`, value: 0 }));
    values.forEach((item) => {
      const ratio = high === low ? 0 : (item[chart.metric] - low) / (high - low);
      bins[Math.min(4, Math.floor(ratio * 5))].value += 1;
    });
    return <ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip formatter={(value) => `${value} observations`} /><Pie data={bins} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={chart.type === 'donut' ? 52 : 0} outerRadius={92} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>{bins.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer>;
  }

  if (chart.type === 'radar') {
    const fields = METRICS.map((item) => {
      const numbers = data.map((row) => toNumber(row[item.value])).filter((value) => value != null);
      return { subject: item.label, value: numbers.length ? Math.min(100, Math.round((numbers.reduce((sum, value) => sum + Math.abs(value), 0) / numbers.length) / Math.max(...numbers.map(Math.abs), 0.000001) * 100)) : 0 };
    });
    return <ResponsiveContainer width="100%" height="100%"><RadarChart data={fields} outerRadius="72%"><Tooltip formatter={(value) => `${value}/100`} /><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} /></RadarChart></ResponsiveContainer>;
  }

  if (chart.type === 'scatter') {
    return <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>{grid}<XAxis type="number" dataKey="index" tickFormatter={(value) => data[value]?.date?.slice(5) || ''} domain={[0, Math.max(data.length - 1, 1)]} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis dataKey={chart.metric} type="number" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} width={62} />{tooltip}<Scatter data={data} dataKey={chart.metric} fill={color} /></ScatterChart></ResponsiveContainer>;
  }

  if (chart.type === 'bar') {
    return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey={chart.metric} fill={color} radius={[3, 3, 0, 0]} maxBarSize={14} /></BarChart></ResponsiveContainer>;
  }

  if (chart.type === 'area') {
    return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}><defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3} /><stop offset="95%" stopColor={color} stopOpacity={0.02} /></linearGradient></defs>{grid}{xAxis}{yAxis}{tooltip}<Area type="monotone" dataKey={chart.metric} stroke={color} strokeWidth={2} fill={`url(#fill-${id})`} dot={false} /></AreaChart></ResponsiveContainer>;
  }

  if (chart.type === 'composed') {
    return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>{grid}{xAxis}<YAxis yAxisId="rate" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} width={62} /><YAxis yAxisId="percentage" orientation="right" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 10, fill: '#64748b' }} width={42} />{tooltip}<Area yAxisId="rate" type="monotone" dataKey={chart.metric} fill={color} fillOpacity={0.12} stroke="none" /><Bar yAxisId="percentage" dataKey="pct_change" fill="#d97706" fillOpacity={0.3} maxBarSize={10} /><Line yAxisId="rate" type="monotone" dataKey={chart.metric} stroke={color} strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer>;
  }

  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>{grid}{xAxis}{yAxis}{tooltip}<Line type="monotone" dataKey={chart.metric} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer>;
}

export default function ChartStudio({ rates = [] }) {
  const [charts, setCharts] = useState(initialCharts);
  const [range, setRange] = useState('365');
  const safeRates = Array.isArray(rates) ? rates : [];
  const data = useMemo(() => {
    const window = range === 'all' ? safeRates : safeRates.slice(-Number(range));
    return window.map((row, index) => ({
      ...row,
      index,
      rate: toNumber(row.rate),
      abs_change: toNumber(row.abs_change),
      pct_change: toNumber(row.pct_change),
      annualized_volatility: toNumber(row.annualized_volatility),
    }));
  }, [safeRates, range]);

  const save = (next) => {
    setCharts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  };

  const updateChart = (id, field, value) => save(charts.map((chart) => chart.id === id ? { ...chart, [field]: value } : chart));

  return (
    <section className="chart-studio">
      <div className="chart-studio-toolbar">
        <div>
          <h3 className="chart-studio-title">Chart Studio</h3>
          <p className="chart-studio-description">Build a dashboard with line, area, bar, scatter, combo, pie, donut, and radar graphs. Your chart layout is saved on this device.</p>
        </div>
        <div className="chart-studio-actions">
          <label className="chart-control"><span>Period</span><select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">30 observations</option><option value="90">90 observations</option><option value="365">365 observations</option><option value="all">All history</option></select></label>
          <button className="add-chart-btn" onClick={() => save([...charts, makeChart()])}>＋ Add graph</button>
        </div>
      </div>

      {data.length === 0 ? <div className="chart-card empty-chart"><p>Load historical rates to build graphs.</p></div> : (
        <div className="chart-studio-grid">
          {charts.map((chart, index) => {
            const metric = METRICS.find((item) => item.value === chart.metric) || METRICS[0];
            const typeLabel = CHART_TYPES.find((item) => item.value === chart.type)?.label || 'Line';
            return (
              <article className="chart-card studio-chart-card" key={chart.id}>
                <div className="studio-chart-header">
                  <div><h4>{typeLabel} graph</h4><span>{metric.label} · {data.length} observations</span></div>
                  <button className="remove-chart-btn" aria-label={`Remove graph ${index + 1}`} title="Remove graph" onClick={() => save(charts.filter((item) => item.id !== chart.id))}>×</button>
                </div>
                <div className="studio-chart-controls">
                  <label className="chart-control"><span>Type</span><select value={chart.type} onChange={(event) => updateChart(chart.id, 'type', event.target.value)}>{CHART_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  <label className="chart-control"><span>Metric</span><select value={chart.metric} onChange={(event) => updateChart(chart.id, 'metric', event.target.value)}>{METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                </div>
                <div className="studio-chart-plot"><ChartContent chart={chart} data={data} metric={metric} id={chart.id} /></div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
