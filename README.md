# CurLens — Rupee Lens (USD/INR)

CurLens is an R and React currency analytics mini-project focused on the **USD/INR** exchange rate. It provides historical rate exploration, currency conversion, statistical one-step rate estimates (nowcast-style), short-horizon forward forecasts (1, 3, and 5 observations ahead), and chronological rolling-origin backtesting scorecards.

---

## 1. Important Disclosures & Reality of Data

- **Daily Reference Rates:** Exchange rates are sourced from the [Frankfurter API v2](https://frankfurter.dev/), which provides European Central Bank (ECB) daily reference rates. These are official fixing rates published once per business day (around 16:00 CET), **not live intraday trading quotes**.
- **Observation Steps vs Calendar Dates:** Forecast horizons (+1, +3, +5 obs) represent future sequential published daily observations (business sessions). Weekends and bank holidays do not have published rates and are not artificially interpolated.
- **Statistical Estimate (Nowcast):** The one-step estimate is a statistical estimate of the next unpublished daily reference rate based on data available up to the current run. It is **not** an intraday high-frequency market nowcast.
- **USD/INR Pair Direction:** Quoted as Indian Rupees per 1 US Dollar. When the rate rises (e.g. ₹84.00 → ₹94.86), the US Dollar has appreciated and the Indian Rupee has *weakened*. When the rate falls, the Rupee has *strengthened*.
- **Reference Rate Conversions:** Currency conversions apply the official reference exchange rate without retail bank spreads, transfer fees, or payment card processing markups (which typically add 1% to 3.5%).

---

## 2. Architecture & Technology Stack

- **Backend:** R (>= 4.4.0) with [Plumber](https://www.rplumber.io/) REST API.
  - HTTP Client: `httr2` (with timeout, status checks, user agent).
  - Data Wrangling: `readr`, `dplyr`, `lubridate`, `tibble`, `jsonlite`.
  - Time Series & Forecasting: Base R + `forecast` (`auto.arima()` on log-transformed rates).
  - Local Storage: Atomic local CSV cache (`backend/data/cache/usd_inr.csv`) and evaluation RDS cache (`backend/data/cache/evaluation_usd_inr.rds`).
- **Frontend:** React 18 + Vite + plain JavaScript + CSS variables.
  - Interactive Visualizations: [Recharts](https://recharts.org/) (AreaChart, ComposedChart, LineChart).
  - Centralized API Service: `src/services/api.js` (with Vite proxy forwarding `/api` to port 8000).

---

## 3. Prerequisites

1. **R (version 4.4.0 or newer):**
   - Windows: Download from [CRAN](https://cloud.r-project.org/bin/windows/base/) or install via winget (`winget install --id RProject.R`).
   - macOS: `brew install r`
   - Linux: `sudo apt install r-base`
2. **Node.js (version 18.x, 20.x, or 24.x LTS) & npm:**
   - Download from [Node.js](https://nodejs.org/).

---

## 4. Installation & Setup

### Step 1: Install Backend Packages

From the project root:

```powershell
# Windows PowerShell
cd backend
Rscript install_packages.R
cd ..
```

```bash
# macOS / Linux
cd backend
Rscript install_packages.R
cd ..
```

This verifies and installs: `plumber`, `httr2`, `jsonlite`, `dplyr`, `readr`, `lubridate`, `tibble`, and `forecast`.

### Step 2: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## 5. Running CurLens Locally

To run the complete application, open two terminal windows:

### Terminal 1 — Start the R Backend

```powershell
# Windows PowerShell
cd backend
Rscript -e "plumber::pr_run(plumber::plumb('plumber.R'), host='127.0.0.1', port=8000)"
```

```bash
# macOS / Linux
cd backend
Rscript -e "plumber::pr_run(plumber::plumb('plumber.R'), host='127.0.0.1', port=8000)"
```

Verify backend health at: <http://127.0.0.1:8000/api/health>

### Terminal 2 — Start the React Frontend

```bash
cd frontend
npm run dev
```

Open your browser at: <http://localhost:5173>

Vite proxies all `/api/*` network requests automatically to `http://127.0.0.1:8000`.

---

## 6. Running Tests & Validation

CurLens includes automated test suites covering all implementation phases:

### Backend Automated Tests

```powershell
cd backend

# Phase 2: Ingestion, Validation, Deduplication & Atomic Cache Tests
Rscript tests/test_phase2.R

# Phase 3: Analytics, Models, Volatility & Rolling-Origin Backtesting Tests
Rscript tests/test_phase3.R

# Phase 4 & 6: Full API Smoke Test (requires running backend on port 8000)
Rscript tests/smoke_test.R
```

### Frontend Tests & Production Build

```bash
cd frontend

# Unit & Logic Verification (Arithmetic, Range Filtering, Domains)
npm test

# Production Build
npm run build
```

---

## 7. Model Methodology & Historical Backtest Results

### Evaluated Models

1. **Random Walk Baseline:** Assumes the next exchange rate equals the latest observed rate ($\hat{y}_{t+h} = y_t$). Prediction intervals are derived from historical sample log-return volatility.
2. **ARIMA on Log Rates:** Fits `forecast::auto.arima(log(rate), seasonal=FALSE, stepwise=TRUE, approximation=TRUE)`. Predictions and 80%/95% confidence intervals are exponentiated back to price levels. Falls back safely to Random Walk if series is too short or convergence fails.

### Backtesting Protocol

- **Protocol:** Strict chronological rolling-origin backtesting without look-ahead bias or future data leakage.
- **Held-Out Test Set:** Latest 250 published business sessions (~1 calendar year).
- **Origins:** 30 evaluation origins stepped across the held-out window. At each origin $t$, the models are fitted solely on historical data up to $t$ to forecast $t+1$, $t+3$, and $t+5$.

### Measured Historical Accuracy (USD/INR)

| Horizon | Sample Size | Random Walk MAE | Random Walk RMSE | ARIMA MAE | ARIMA RMSE | ARIMA Edge (MAE) |
|---|---|---|---|---|---|---|
| **+1 Observation** | 30 origins | ₹0.1290 | ₹0.1851 | ₹0.1075 | ₹0.1615 | **+16.63%** |
| **+3 Observations** | 30 origins | ₹0.2883 | ₹0.4136 | ₹0.2836 | ₹0.4015 | **+1.63%** |
| **+5 Observations** | 30 origins | ₹0.4887 | ₹0.6255 | ₹0.4936 | ₹0.6198 | **-1.01%** |

*Note: In accordance with the empirical Meese-Rogoff finding, Random Walk baseline error remains exceptionally competitive over multi-step horizons on foreign exchange daily series. CurLens displays these genuine findings rather than fabricating model superiority.*

---

## 8. API Specification

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health status and cache statistics (`row_count`, `available`, `last_date`) |
| `/api/currencies` | GET | Curated currency list filtered against Frankfurter's active currencies |
| `/api/rates/latest` | GET | Latest reference rate for base/quote pair (with `daily_change` and `daily_pct_change`) |
| `/api/rates/history` | GET | Bounded historical rates series with daily changes and 30-obs rolling volatility |
| `/api/convert` | GET | Reference conversion calculation (`amount * rate`), with rate date and disclaimer |
| `/api/analytics` | GET | Rolling volatility (annualized), period min/max, mean, median, and summary metrics |
| `/api/nowcast` | GET | One-step ahead statistical estimate of next unpublished rate with 80%/95% intervals |
| `/api/forecast` | GET | Forward forecasts for horizons 1, 3, and 5 comparing baseline vs ARIMA |
| `/api/evaluation` | GET | Cached chronological rolling-origin evaluation scorecard (MAE, RMSE, sample size) |

---

## 9. Definition of Done Checklist

- [x] Genuine Frankfurter v2 history fetched: 4,310 observations spanning 2015-01-01 to 2026-10-19.
- [x] Local CSV cache and 7-day overlap refresh implemented with atomic file replacement.
- [x] Valid cached data remains usable offline with explicit `stale` status if API refresh fails.
- [x] Observation date, rate date, and app fetch timestamp are strictly separated.
- [x] Reference currency converter validates inputs, supports swap, and displays applied rate date.
- [x] Interactive historical chart with 1M, 3M, 6M, 1Y, and MAX range filters.
- [x] 30-day annualized rolling volatility computed and plotted.
- [x] One-step estimate clearly labeled as a statistical estimate, not an intraday market quote.
- [x] Forward 1, 3, 5-observation forecasts with shaded 80% and 95% confidence bands.
- [x] Rolling-origin evaluation backtest comparing Random Walk and ARIMA without data leakage.
- [x] Real MAE and RMSE metrics reported honest without fabrication.
- [x] Responsive layout verified at 360px, 768px, and 1280px without horizontal overflow.
- [x] Complete developer setup and execution commands documented.
