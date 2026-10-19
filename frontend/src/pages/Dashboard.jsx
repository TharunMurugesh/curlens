import React from 'react';
import MetricCard from '../components/MetricCard';
import RateChart from '../components/RateChart';
import CurrencyConverter from '../components/CurrencyConverter';
import StatusNotice from '../components/StatusNotice';

export default function Dashboard({
  latestRate,
  analytics,
  nowcast,
  historyRates,
  currencies,
  dataStatus,
  onNavigate,
  onRetry,
}) {
  const isStale = dataStatus === 'stale';

  return (
    <div className="dashboard-page">
      {isStale && (
        <StatusNotice
          type="stale"
          message="Displaying Cached Reference Rates"
          details="Frankfurter API refresh did not complete or network is offline; serving verified local cache."
          onRetry={onRetry}
        />
      )}

      <div className="metrics-grid">
        <MetricCard
          title="Latest USD/INR Rate"
          value={latestRate ? `₹${Number(latestRate.rate).toFixed(4)}` : '—'}
          change={latestRate?.daily_change}
          pctChange={latestRate?.daily_pct_change}
          isRateMovement={true}
          subtitle={latestRate?.date ? `Observation Date: ${latestRate.date}` : null}
          badge="ECB Reference"
        />

        <MetricCard
          title="One-Step Rate Estimate"
          value={nowcast?.arima_estimate ? `₹${Number(nowcast.arima_estimate).toFixed(4)}` : '—'}
          change={
            nowcast && latestRate
              ? Number(nowcast.arima_estimate) - Number(latestRate.rate)
              : null
          }
          pctChange={
            nowcast && latestRate
              ? ((Number(nowcast.arima_estimate) - Number(latestRate.rate)) / Number(latestRate.rate)) * 100
              : null
          }
          isRateMovement={true}
          subtitle={`Model: ${nowcast?.model_specification || nowcast?.model_name || 'ARIMA'}`}
          badge="Statistical Estimate"
          annotation="One observation ahead; not an intraday market quote."
        />

        <MetricCard
          title="30-Day Volatility"
          value={
            analytics?.latest_annualized_volatility
              ? `${analytics.latest_annualized_volatility}%`
              : '—'
          }
          subtitle="Annualized sample standard deviation"
          badge="30-Obs Window"
        />

        <MetricCard
          title="Historical Coverage"
          value={
            analytics?.observation_count
              ? `${analytics.observation_count.toLocaleString()} obs`
              : '—'
          }
          subtitle={
            analytics?.start_date && analytics?.end_date
              ? `${analytics.start_date} to ${analytics.end_date}`
              : 'Loading series...'
          }
          badge="ECB Reference Data"
        />
      </div>

      <div className="dashboard-content-grid">
        <div className="dashboard-chart-col">
          <RateChart rates={historyRates} title="USD/INR Exchange Rate History" height={360} />
        </div>

        <div className="dashboard-side-col">
          <CurrencyConverter currencies={currencies} defaultFrom="USD" defaultTo="INR" />

          <div className="forecast-preview-card">
            <div className="preview-header">
              <h4>Short-Horizon Forecast</h4>
              <button className="link-btn" onClick={() => onNavigate('forecasts')}>
                View Scorecard →
              </button>
            </div>
            <p className="preview-text">
              ARIMA model estimates rate movements over 1, 3, and 5 business observations. Evaluated against a Random Walk baseline.
            </p>
            {nowcast?.arima_intervals?.lower_80 && (
              <div className="preview-intervals">
                <span className="interval-label">80% Confidence Interval:</span>
                <span className="interval-val">
                  ₹{Number(nowcast.arima_intervals.lower_80).toFixed(2)} – ₹{Number(nowcast.arima_intervals.upper_80).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

