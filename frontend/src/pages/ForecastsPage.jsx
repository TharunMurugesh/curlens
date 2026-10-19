import React from 'react';
import ForecastChart from '../components/ForecastChart';

export default function ForecastsPage({
  nowcast,
  forecast,
  evaluation,
  historyRates = [],
  onRecalculateEvaluation,
  evaluating = false,
}) {
  const latestObsRate = nowcast?.latest_observed_rate;
  const latestObsDate = nowcast?.latest_observation_date;
  const horizonsList = Array.isArray(forecast?.horizons) ? forecast.horizons : [];
  const scorecardList = Array.isArray(evaluation?.scorecard) ? evaluation.scorecard : [];

  return (
    <div className="forecasts-page">
      <div className="page-header">
        <h2 className="page-title">Rate Estimates & Historical Model Evaluation</h2>
        <p className="page-description">
          Short-horizon estimates for USD/INR reference rates, compared with a random-walk baseline through chronological backtesting.
        </p>
      </div>

      <div className="disclosure-banner">
        <div className="disclosure-icon">⚖️</div>
        <div className="disclosure-content">
            <strong>About these estimates</strong>
          <p>
            {nowcast?.disclaimer ||
              'This is a statistical estimate of the next reference-rate observation, not a live market quote. Frankfurter publishes daily reference rates; this project does not use intraday prices.'}
          </p>
        </div>
      </div>

      <div className="nowcast-feature-card">
        <div className="nowcast-header">
          <div>
            <span className="nowcast-badge">One-Step Ahead Statistical Estimate</span>
            <h3 className="nowcast-title">Next Reference Rate Observation</h3>
          </div>
          <div className="model-tag">
            {nowcast?.model_specification || nowcast?.model_name || 'ARIMA on log rates'}
          </div>
        </div>

        <div className="nowcast-body-grid">
          <div className="nowcast-stat">
            <span className="stat-caption">Latest Published Rate</span>
            <span className="stat-big">{latestObsRate != null ? `₹${Number(latestObsRate).toFixed(4)}` : '—'}</span>
            <span className="stat-sub">Observation Date: {latestObsDate || '—'}</span>
          </div>

          <div className="nowcast-stat estimate-stat">
            <span className="stat-caption">Model Estimate (Next Obs)</span>
            <span className="stat-big estimate-val">
              {nowcast?.arima_estimate != null ? `₹${Number(nowcast.arima_estimate).toFixed(4)}` : '—'}
            </span>
            <span className="stat-sub">
              Baseline (Random Walk): {nowcast?.baseline_estimate != null ? `₹${Number(nowcast.baseline_estimate).toFixed(4)}` : '—'}
            </span>
          </div>

          <div className="nowcast-stat interval-stat">
            <span className="stat-caption">Estimated Confidence Intervals</span>
            <div className="ci-row">
              <span className="ci-badge">80% CI</span>
              <span className="ci-values">
                {nowcast?.arima_intervals?.lower_80 != null && nowcast?.arima_intervals?.upper_80 != null
                  ? `₹${Number(nowcast.arima_intervals.lower_80).toFixed(2)} – ₹${Number(nowcast.arima_intervals.upper_80).toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="ci-row">
              <span className="ci-badge">95% CI</span>
              <span className="ci-values">
                {nowcast?.arima_intervals?.lower_95 != null && nowcast?.arima_intervals?.upper_95 != null
                  ? `₹${Number(nowcast.arima_intervals.lower_95).toFixed(2)} – ₹${Number(nowcast.arima_intervals.upper_95).toFixed(2)}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ForecastChart
        recentHistory={Array.isArray(historyRates) ? historyRates : []}
        forecastHorizons={horizonsList}
        height={380}
      />

      <div className="table-card">
        <div className="card-header-row">
          <div>
            <h3 className="table-title">Forward Forecast Horizon Comparison</h3>
            <span className="table-subtitle">Sequential business observation steps ahead</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Horizon</th>
                <th>Random Walk Baseline</th>
                <th>ARIMA Estimate</th>
                <th>80% Confidence Interval</th>
                <th>95% Confidence Interval</th>
              </tr>
            </thead>
            <tbody>
              {horizonsList.map((h, idx) => {
                const hNum = h.horizon_observations || idx + 1;
                const rw = h.baseline || {};
                const ar = h.arima || {};
                return (
                  <tr key={hNum}>
                    <td>
                      <strong>+{hNum} {hNum === 1 ? 'observation' : 'observations'}</strong>
                      <div className="sub-label">Next {hNum === 1 ? 'business session' : `${hNum} business sessions`}</div>
                    </td>
                    <td className="rate-col">
                      {rw.prediction != null ? `₹${Number(rw.prediction).toFixed(4)}` : '—'}
                    </td>
                    <td className="rate-col" style={{ color: '#2563eb', fontWeight: 600 }}>
                      {ar.prediction != null ? `₹${Number(ar.prediction).toFixed(4)}` : '—'}
                      <div className="sub-label">{ar.model_specification || 'ARIMA'}</div>
                    </td>
                    <td>
                      {ar.lower_80 != null && ar.upper_80 != null
                        ? `₹${Number(ar.lower_80).toFixed(2)} – ₹${Number(ar.upper_80).toFixed(2)}`
                        : '—'}
                    </td>
                    <td>
                      {ar.lower_95 != null && ar.upper_95 != null
                        ? `₹${Number(ar.lower_95).toFixed(2)} – ₹${Number(ar.upper_95).toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card evaluation-card">
        <div className="card-header-row">
          <div>
            <h3 className="table-title">Historical Rolling-Origin Backtest Scorecard</h3>
            <span className="table-subtitle">
              Strict chronological validation over {evaluation?.num_origins || 30} historical test origins (held-out window of {evaluation?.test_size || 250} sessions, no future data leakage)
            </span>
          </div>
          {onRecalculateEvaluation && (
            <button
              className="refresh-btn small-btn"
              onClick={onRecalculateEvaluation}
              disabled={evaluating}
            >
              {evaluating ? 'Running backtest...' : '⚡ Recompute Backtest'}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="data-table scorecard-table">
            <thead>
              <tr>
                <th rowSpan="2">Horizon</th>
                <th rowSpan="2">Sample Size</th>
                <th colSpan="2">Random Walk Baseline</th>
                <th colSpan="2">ARIMA Model</th>
                <th rowSpan="2">ARIMA MAE Edge</th>
              </tr>
              <tr>
                <th>MAE</th>
                <th>RMSE</th>
                <th>MAE</th>
                <th>RMSE</th>
              </tr>
            </thead>
            <tbody>
              {scorecardList.map((sc, idx) => {
                const h = sc.horizon_observations || idx + 1;
                const rw = sc.random_walk || {};
                const ar = sc.arima || {};
                const rawEdge = sc.arima_improvement_mae_pct;
                const edgeNum = typeof rawEdge === 'number' ? rawEdge : (Array.isArray(rawEdge) ? Number(rawEdge[0]) : (rawEdge != null ? Number(rawEdge) : null));
                const hasEdge = edgeNum != null && !isNaN(edgeNum) && edgeNum > 0;
                return (
                  <tr key={h}>
                    <td><strong>+{h} {h === 1 ? 'observation' : 'observations'}</strong></td>
                    <td>{sc.sample_size != null ? `${sc.sample_size} origins` : '—'}</td>
                    <td>{rw.mae != null ? `₹${Number(rw.mae).toFixed(4)}` : '—'}</td>
                    <td>{rw.rmse != null ? `₹${Number(rw.rmse).toFixed(4)}` : '—'}</td>
                    <td style={{ fontWeight: 600 }}>{ar.mae != null ? `₹${Number(ar.mae).toFixed(4)}` : '—'}</td>
                    <td>{ar.rmse != null ? `₹${Number(ar.rmse).toFixed(4)}` : '—'}</td>
                    <td>
                      {edgeNum != null && !isNaN(edgeNum) ? (
                        <span
                          className={`edge-pill ${hasEdge ? 'positive' : 'negative'}`}
                        >
                          {hasEdge ? `+${edgeNum.toFixed(2)}%` : `${edgeNum.toFixed(2)}%`}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="scorecard-notes">
          <p>
            📌 <strong>Interpretation:</strong> In empirical finance (Meese-Rogoff puzzle), the random-walk baseline is notoriously difficult to beat for exchange-rate movements over short horizons. While ARIMA captures serial correlation in log differences and provides calibrated uncertainty intervals, random walk errors remain very competitive.
          </p>
        </div>
      </div>
    </div>
  );
}

