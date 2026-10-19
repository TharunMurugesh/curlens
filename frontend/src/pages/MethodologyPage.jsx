import React from 'react';

export default function MethodologyPage() {
  return (
    <div className="methodology-page">
      <div className="page-header">
        <h2 className="page-title">Methodology & Design Disclosures</h2>
        <p className="page-description">
          Transparent technical and financial disclosures regarding data provenance, model assumptions, backtesting protocols, and limitations.
        </p>
      </div>

      <div className="methodology-cards">
        <div className="methodology-card">
          <div className="card-badge">Data Provenance</div>
          <h3>1. Data Provider and Reference Rates</h3>
          <p>
            CurLens ingests historical and daily currency data from the open-source <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter API v2</a>, which tracks official daily reference exchange rates published by the European Central Bank (ECB).
          </p>
          <ul className="methodology-list">
            <li>
              <strong>Daily Reference Rates:</strong> Rates are published once every European banking business day (around 16:00 CET). They are fixing reference rates, <em>not real-time trading quotes</em> or tick-by-tick prices.
            </li>
            <li>
              <strong>No Weekend Interpolation:</strong> Financial foreign exchange markets close over weekends and central bank holidays. These gaps are natural non-publishing sessions and are preserved without synthetic interpolation.
            </li>
            <li>
              <strong>Local Caching:</strong> All historical series are cached locally in an atomic CSV store (<code>backend/data/cache/usd_inr.csv</code>) with a 7-day overlap check to keep requests lightweight and preserve offline functionality.
            </li>
          </ul>
        </div>

        <div className="methodology-card">
          <div className="card-badge">FX Interpretation</div>
          <h3>2. Currency Pair Quotation & Interpretation</h3>
          <p>
            The primary currency pair in CurLens is <strong>USD/INR</strong>, quoted as the amount of Indian Rupees (INR) required to purchase one United States Dollar (USD).
          </p>
          <div className="callout-box">
            <div>📈 <strong>Rate Rises (e.g. ₹84.00 → ₹94.80):</strong> The US Dollar appreciates; the Indian Rupee <em>weakens</em>.</div>
            <div>📉 <strong>Rate Falls (e.g. ₹94.80 → ₹92.00):</strong> The US Dollar depreciates; the Indian Rupee <em>strengthens</em>.</div>
          </div>
        </div>

        <div className="methodology-card">
          <div className="card-badge">Time Series Modeling</div>
          <h3>3. Model Specifications</h3>
          <p>
            To avoid spurious overfitting and maintain bounded runtime on Antigravity's free tier, CurLens restricts time-series modeling to exactly two parsimonious statistical models:
          </p>
          <div className="model-grid">
            <div className="model-box">
              <h4>1. Random Walk Baseline (Naïve)</h4>
              <p>
                In line with the classic Meese & Rogoff (1983) empirical FX benchmark, future spot exchange rates are assumed to equal the latest observed spot rate:
              </p>
              <code>ŷ&#123;t+h&#125; = y&#123;t&#125;</code>
              <p>
                Prediction intervals expand as a function of the historical daily log-return volatility: <code>SE&#123;h&#125; = σ × √h</code>.
              </p>
            </div>

            <div className="model-box">
              <h4>2. ARIMA on Log Exchange Rates</h4>
              <p>
                Fits an autoregressive integrated moving average model on log-transformed rates using <code>forecast::auto.arima()</code> with:
              </p>
              <code>auto.arima(log(rate), seasonal=FALSE, stepwise=TRUE, approximation=TRUE)</code>
              <p>
                Forecasts and 80%/95% interval bounds are computed on the log scale and exponentiated back to price levels. If historical data is insufficient or convergence fails, it safely falls back to the Random Walk baseline.
              </p>
            </div>
          </div>
        </div>

        <div className="methodology-card">
          <div className="card-badge">Validation Protocol</div>
          <h3>4. Chronological Rolling-Origin Backtesting</h3>
          <p>
            To prevent <strong>look-ahead bias</strong> and <strong>future data leakage</strong>, models are evaluated strictly in temporal order:
          </p>
          <ul className="methodology-list">
            <li>
              <strong>Held-Out Test Set:</strong> The latest ~250 published business sessions (~1 calendar year) are reserved for out-of-sample evaluation.
            </li>
            <li>
              <strong>Rolling Origins:</strong> The evaluation steps through 30 distinct historical origins. At each origin <code>t</code>, the model trains <em>solely</em> on observations up to <code>t</code>, generates forecasts for horizons <code>t+1</code>, <code>t+3</code>, and <code>t+5</code>, and compares them with actual published rates.
            </li>
            <li>
              <strong>Evaluation Metrics:</strong>
              <ul>
                <li><strong>MAE (Mean Absolute Error):</strong> <code>(1/N) ∑ |y - ŷ|</code></li>
                <li><strong>RMSE (Root Mean Square Error):</strong> <code>√[(1/N) ∑ (y - ŷ)²]</code></li>
                <li><strong>Directional Accuracy:</strong> Percentage of horizons where predicted direction matches actual market direction.</li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="methodology-card">
          <div className="card-badge">Disclosures & Limitations</div>
          <h3>5. Explicit Disclosures & Non-Goals</h3>
          <ul className="methodology-list">
            <li>
              <strong>Not Intraday Nowcasting:</strong> Because Frankfurter supplies daily reference fixings rather than high-frequency order books or tick data, the one-step estimate is an estimate of the next published daily rate, not an intraday market nowcast.
            </li>
            <li>
              <strong>Not Investment Advice:</strong> Statistical estimates and confidence bands are for research, education, and reference rate visualization only. They are not intended as trading signals, financial advice, or currency hedging recommendations.
            </li>
            <li>
              <strong>Past Performance:</strong> Historical backtesting performance is no guarantee of future forecasting accuracy.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
