import React from 'react';

export default function MetricCard({
  title,
  value,
  subtitle,
  change,
  pctChange,
  isRateMovement = false, // if true, positive change means INR weakness (upward USD/INR)
  badge,
  annotation,
}) {
  const hasChange = typeof change === 'number' && !isNaN(change);
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;
  const isZero = hasChange && change === 0;

  // For USD/INR:
  // Rate increase = INR weakening (loss of purchasing power against USD)
  // Rate decrease = INR strengthening
  const changeColor = isPositive ? 'var(--color-warning)' : isNegative ? 'var(--color-success)' : 'var(--text-muted)';

  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        {badge && <span className="metric-badge">{badge}</span>}
      </div>

      <div className="metric-value-row">
        <span className="metric-value">{value ?? '—'}</span>
        {hasChange && (
          <div className="metric-change" style={{ color: changeColor }}>
            <span>{isPositive ? '▲ +' : isNegative ? '▼ ' : '• '}</span>
            <span>{Math.abs(change).toFixed(2)}</span>
            {pctChange !== undefined && (
              <span className="metric-pct"> ({isPositive ? '+' : ''}{Number(pctChange).toFixed(2)}%)</span>
            )}
          </div>
        )}
      </div>

      {isRateMovement && hasChange && (
        <div className="metric-interpretation">
          {isPositive ? 'Rupee weakened' : isNegative ? 'Rupee strengthened' : 'Unchanged'}
        </div>
      )}

      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      {annotation && <div className="metric-annotation">{annotation}</div>}
    </div>
  );
}
