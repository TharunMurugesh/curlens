# CurLens

CurLens is a currency analytics application for exploring the USD/INR exchange rate. It combines published reference-rate data, historical analysis, currency conversion, statistical forecasts, and model evaluation in a browser-based interface.

## Project overview

The application uses daily reference rates from the [Frankfurter API](https://frankfurter.dev/). Rates are published observations, not live trading prices. CurLens presents the observation date with rate data and distinguishes observed values from model estimates.

The USD/INR pair is quoted as Indian rupees per US dollar. A rising rate means the rupee has weakened against the dollar; a falling rate means it has strengthened, all else equal.

## Capabilities

- Dashboard with the latest published USD/INR rate, rate movements, volatility, and historical coverage.
- Currency conversion using published reference rates.
- Historical rate charts, daily changes, summary statistics, and rolling volatility.
- One-observation-ahead estimates and 1, 3, and 5-observation forecasts.
- Chronological rolling-origin evaluation comparing ARIMA with a random-walk baseline.
- Local rate caching with a stale-data fallback when the upstream service is unavailable.

## Data and methodology

Frankfurter provides daily reference rates sourced from the European Central Bank. Rates are generally updated on business days. Weekends and holidays have no published observations; CurLens does not interpolate rates across those gaps.

CurLens compares two forecasting approaches:

- **Random walk:** future rates equal the latest observed rate. Prediction intervals use historical log-return volatility.
- **ARIMA:** an automatically selected ARIMA model is fit to log-transformed rates. Forecasts and intervals are converted back to rate levels. The random-walk estimate is used as a fallback when the ARIMA fit cannot be produced.

Model evaluation proceeds in chronological order. At each origin, the models use only observations available up to that point and are evaluated at the configured forecast horizons. Reported errors describe historical performance and do not guarantee future accuracy.

The one-step estimate refers to the next unpublished daily reference-rate observation. It is not an intraday nowcast, a live quote, investment advice, or a trading signal. Currency conversions are indicative calculations using reference rates and do not include bank spreads, fees, or payment-provider charges.

## Technology

- **Backend:** R and Plumber
- **Data and models:** `httr2`, `jsonlite`, `dplyr`, `readr`, `lubridate`, `tibble`, and `forecast`
- **Frontend:** React, Vite, and Recharts
- **Storage:** local CSV rate cache and RDS evaluation cache under `backend/data/cache/`

## Requirements

- R 4.4 or newer
- Node.js 18 or newer and npm
- Network access to Frankfurter for the initial data download and subsequent refreshes

## Setup

Install the R dependencies:

```sh
cd backend
Rscript install_packages.R
cd ..
```

Install the frontend dependencies:

```sh
cd frontend
npm install
```

## Run locally

Start the backend in one terminal from the `backend` directory:

```sh
Rscript -e "plumber::pr_run(plumber::plumb('plumber.R'), host='127.0.0.1', port=8000)"
```

Start the frontend in a second terminal from the `frontend` directory:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server forwards `/api` requests to the backend at `127.0.0.1:8000`. The backend health endpoint is available at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

To create a production frontend bundle, run `npm run build` from `frontend`.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Service and local cache status |
| `GET /api/currencies` | Supported currencies |
| `GET /api/rates/latest` | Latest published rate for a currency pair |
| `GET /api/rates/history` | Historical published rates and daily metrics |
| `GET /api/convert` | Reference-rate currency conversion |
| `GET /api/analytics` | Summary statistics and rolling volatility |
| `GET /api/nowcast` | Next-observation statistical estimate |
| `GET /api/forecast` | Multi-horizon forecasts |
| `GET /api/evaluation` | Rolling-origin model evaluation |

The rate endpoints accept the currency pair as query parameters. The history endpoint also accepts `from` and `to` dates in `YYYY-MM-DD` format. The conversion endpoint accepts `amount`, `from`, and `to`; the forecast endpoint accepts a comma-separated `horizons` parameter.

## Local data

The backend stores downloaded USD/INR observations in `backend/data/cache/usd_inr.csv` and evaluation results in `backend/data/cache/evaluation_usd_inr.rds`. The rate cache is refreshed with an overlap window to incorporate corrected or newly published observations. When a refresh fails, valid cached rates remain available and are identified as stale.

## Limitations

CurLens is intended for educational and analytical use. It does not provide real-time prices, transaction quotes, financial advice, or guaranteed forecasts. Upstream data availability, local cache contents, model fit, and network connectivity affect which figures are available in the application.
