# CurLens — Rupee Lens
## Design specification and Antigravity build guide

**Project type:** R data analytics mini-project with a separate web frontend  
**Primary pair:** USD/INR  
**Core capabilities:** exchange-rate explorer, currency converter, one-step rate estimate (nowcast-style), short-horizon forecast, historical model evaluation  
**Build target:** a polished, locally runnable and demo-ready project; keep it small enough to complete on Antigravity's free tier.

---

## 1. Product definition

CurLens helps a user answer four questions quickly:

1. What is the latest **published reference rate** for USD/INR?
2. How has the rate moved over a selected historical period?
3. What is the equivalent amount when converting between supported currencies?
4. What do a simple baseline and an ARIMA model estimate for the next exchange-rate observations, and how accurate have those methods been in historical tests?

### Target users

Students, travellers, people planning international purchases or education costs, and anyone who wants to inspect historical reference exchange rates.

### Success criteria

- The app starts locally using documented commands.
- A real API supplies rates; no fabricated or hard-coded sample rates appear as if live.
- Historical rates are cached locally and survive restarts.
- The UI clearly distinguishes observed rates from model estimates and forecasts.
- A converter, historical chart, nowcast estimate, forecast chart, and model scorecard work end to end.
- A time-ordered test procedure compares ARIMA with a random-walk baseline.
- The UI works on desktop and mobile widths and handles loading, empty data, API errors, and stale data.

### Explicit non-goals

Do **not** build a trading system, investment recommendation service, intraday trading terminal, user login, portfolio manager, payment feature, database server, Docker setup, cloud deployment, microservices, deep learning model, or multi-country macroeconomic model. Do not add more currencies to the forecasting model until USD/INR works end to end.

---

## 2. Important data and modelling truth

### Data provider

Use **Frankfurter API v2**: <https://frankfurter.dev/>. It provides daily reference rates, supports historical time series, needs no API key, and encourages caching. See the live API documentation before coding: <https://frankfurter.dev/docs>.

Useful endpoints:

- Latest rates: `GET https://api.frankfurter.dev/v2/rates?base=USD&quotes=INR`
- Historical USD/INR series: `GET https://api.frankfurter.dev/v2/rates?from=1999-01-04&base=USD&quotes=INR`
- Direct conversion rate: `GET https://api.frankfurter.dev/v2/rate/USD/INR`
- Supported currencies: `GET https://api.frankfurter.dev/v2/currencies`

Confirm the response schema and actual earliest available USD/INR observation against the current API before relying on it. Do not assume all currencies have data from the same start date. If a long-range request is too large or unreliable, retrieve it in year-sized date ranges and combine the results.

**Interpretation:** `USD/INR` is the number of Indian rupees per one US dollar. If this rate rises, the rupee has weakened against the dollar; if it falls, the rupee has strengthened, holding other things constant.

### No false claims about “live” rates

Frankfurter rates update daily, not tick by tick. Display the rate's **observation date** and the app's **last successful fetch time** separately. Call it a *published reference rate*, never a live trading quote. Weekend and public-holiday gaps are normal. Never fill weekends by interpolation or label them as missing trading sessions without context.

### Honest definition of nowcasting

This source does not supply a complete archive of intraday observations or historical snapshots of when each record first became available. Therefore this project cannot claim to perform genuine intraday FX nowcasting.

For this mini-project, define the nowcast clearly as a **one-step estimate of the next not-yet-published daily reference-rate observation**, produced from data available at the current run. It is most relevant when the latest published rate lags the current date. Use the same one-step model output as the near-term forecast's one-observation horizon; do not create two separate models just to make two labels.

In the UI, include this disclosure:

> This is a statistical estimate of the next reference-rate observation, not a live market quote. Frankfurter publishes daily reference rates; this project does not use intraday prices.

Historical evaluation of the one-step estimate is a **rolling one-step-ahead backtest**: at each origin, fit/use only observations up to that point, predict the next recorded rate, and compare it with the subsequently observed rate. Describe this as a backtest/hindcast, not a reconstruction of historical intraday information vintages.

### Forecast horizons

Forecast the next **1, 3, and 5 rate observations** after the latest recorded observation. These correspond to future published observations, usually business days, not guaranteed calendar dates. The one-observation forecast may share the nowcast estimate. Show the horizon in observation steps and avoid pretending holidays can be predicted from this data alone.

---

## 3. Antigravity free-tier operating rules

The free Individual plan lists unlimited Tab completions and Command requests, but only **basic weekly agent rate limits**. Quotas vary with plan, model, capacity and task complexity and may change. Check the usage panel; do not assume a fixed prompt count. Official references: <https://antigravity.google/pricing> and <https://antigravity.google/docs/plans>.

To conserve quota:
- Run **one phase at a time** using Section 11; do not ask for the entire app in one prompt.
- Use the lowest-cost/fast model currently available for routine edits; reserve stronger models for a difficult, isolated bug.
- No parallel agents or autonomous multi-agent workflows.
- Ask for changes only to files required in the current phase. Request targeted diffs, not rewrites or repeated whole-repository reviews.
- Run checks yourself, paste only relevant errors, and avoid asking for line-by-line explanations unless needed.
- After each accepted phase, commit a checkpoint with Git if available.
- Don't repeatedly retry a failing API; test once, inspect the response, then implement proper error handling.
- Do not add dependencies or expand scope without a concrete need.

**Priority if quota is low:** data ingestion/cache → baseline + ARIMA/backtest → API → converter/history UI → forecast/evaluation UI → visual polish. The API must fall back to the baseline if ARIMA fails.

---

## 4. Technology stack — keep this exact unless blocked

### Backend and analytics

- R (base R + tidyverse-style data manipulation)
- `plumber` for a small local REST API
- `httr2` for HTTP requests
- `jsonlite` for JSON handling if needed
- `dplyr`, `readr`, `lubridate`, `tibble` for data processing
- `forecast` for `auto.arima()` and forecast intervals
- `testthat` only if a small test suite is practical; also provide simple smoke-test scripts

Do not introduce a database for the MVP. Use a local CSV cache. Avoid `renv` unless package-version reproducibility becomes a real issue; provide a straightforward dependency installer instead.

### Frontend

- React + Vite + plain JavaScript (not TypeScript for the first version)
- Recharts for charts
- Plain CSS with shared CSS variables; do not add a large UI framework
- `fetch()` through one small API service module

### Data storage

- Main cached series: `backend/data/cache/usd_inr.csv`
- Optional conversion/rates cache only if needed; in-memory caching is sufficient initially.
- Never commit API response dumps or large derived files unnecessarily. Add cache files to `.gitignore` if they are reproducibly generated.

---

## 5. Project layout

```text
curlens/
├── DESIGN.md  README.md  .gitignore
├── backend/
│   ├── plumber.R  install_packages.R
│   ├── R/
│   │   ├── config.R  frankfurter_client.R  rate_store.R
│   │   ├── analytics.R  models.R  validation.R
│   ├── data/cache/.gitkeep
│   └── tests/smoke_test.R
└── frontend/
    ├── index.html  package.json  vite.config.js
    └── src/
        ├── main.jsx  App.jsx  styles.css
        ├── services/api.js
        ├── components/ (AppShell, MetricCard, RateChart, ForecastChart,
        │               CurrencyConverter, StatusNotice)
        └── pages/ (Dashboard, History, Forecasts, Methodology)
```

Keep files small and meaningful. Combine closely related UI components if splitting them slows progress. Do not create empty files just to match this tree.

---

## 6. Data pipeline and data contract

1. Fetch historical USD/INR rates from Frankfurter v2. Inspect the actual response schema; never guess field names.
2. Normalize rows to `date` (R `Date`), `base`, `quote`, positive numeric `rate`, and `fetched_at` (UTC timestamp when this app fetched/updated the row).
3. Sort ascending, drop invalid/non-positive/infinite rates, and keep one row per date. Save atomically via temporary file + rename.
4. On later runs, fetch from seven calendar days before the cached maximum date to the latest available date; merge, de-duplicate, and save. If full-history responses are large, request year-sized ranges.
5. If network refresh fails, serve valid cached data with an explicit stale status. If neither cache nor API is available, return a readable error—not fabricated observations.
6. Do not call the external API on every chart render. Refresh at startup or through an explicit refresh action; cache results.
7. Weekend/holiday gaps are normal. Never interpolate them. `fetched_at` records when this app fetched the row; it is not proof of the publisher's original release time.

Use HTTP timeouts, status checks, and concise logs. No API key should be required for Frankfurter. Cache path: `backend/data/cache/usd_inr.csv`.

---

## 7. Backend API contract

Return JSON with consistent names, ISO dates, numeric values and meaningful HTTP status codes. Use a Vite proxy for local `/api` requests or explicit development-only CORS; avoid both without a reason.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Status and cache availability |
| `GET /api/currencies` | Curated currency list filtered against Frankfurter's supported currencies |
| `GET /api/rates/latest?base=USD&quote=INR` | Latest published observation and observation date |
| `GET /api/rates/history?base=USD&quote=INR&from=2015-01-01&to=2026-10-19` | Validated, bounded history range |
| `GET /api/convert?amount=100&from=USD&to=INR` | Conversion result, pair rate and rate date |
| `GET /api/analytics?window=30` | Daily change, rolling volatility and summary metrics |
| `GET /api/nowcast` | Estimate of the next rate observation, intervals if available, latest actual and disclosure |
| `GET /api/forecast?horizons=1,3,5` | Baseline + ARIMA estimates and intervals for 1/3/5 observations |
| `GET /api/evaluation` | Rolling-origin model metrics by horizon, cached if expensive |

Model responses should include `pair`, `generated_at` (UTC ISO 8601), `latest_observation_date`, `latest_observed_rate`, `model_name`, `horizon_observations`, `prediction`, intervals when available, `data_status` and `disclaimer`. Errors should return a readable `error` and stable `code`, e.g. `DATA_UNAVAILABLE`. Never fabricate outputs to make charts render.

Conversion: use Frankfurter's direct pair-rate endpoint or a correctly derived cross-rate. `converted_amount = amount * rate`; identical source/target returns rate 1. Validate finite amount and supported codes. Round only display values. Label the result a reference-rate conversion, not a guaranteed bank/payment-provider rate.

---

## 8. Analytics and model methodology

**Target:** daily `USD/INR` reference rate (INR per USD). Use the available historical date range and document its actual start/end after fetching. Plot levels and daily percentage/log changes; calculate 30-observation rolling volatility and label the formula.

### Only two models

1. **Random-walk baseline:** every future point forecast equals the latest observed rate.
2. **ARIMA:** use `forecast::auto.arima(log(rate), seasonal=FALSE, stepwise=TRUE, approximation=TRUE)`. Forecast on the log scale and exponentiate predictions and interval bounds. Keep runtime bounded. If history is too short or fitting fails, return the baseline plus a warning.

No LSTM, XGBoost, neural networks, sentiment, macro predictors or extra forecast packages.

### Evaluation protocol

- Use chronological splits only. Reserve the latest 20% (or about the latest 250 observations when there is enough history) for final testing; verify enough training rows remain.
- Run rolling-origin backtesting over about 30–50 origins in the held-out range. At each origin, use only prior observations and predict 1, 3 and 5 rate observations ahead. Stride origins if runtime is high.
- Report MAE and RMSE for each model/horizon. Directional accuracy is optional and must be defined. Never use test data to tune model settings.
- Cache expensive backtest outputs and invalidate them when source data or model code changes. Do not claim ARIMA is better unless the measured results support it.

### Nowcast-style estimate

At each historical origin `t`, estimate observation `t+1` from data through `t` and compare it with the actual `t+1` rate; report errors against the random-walk baseline. The live endpoint estimates one observation beyond the latest published rate. Use the same one-step result for forecast horizon 1 to avoid inconsistent duplicate estimates. If the next publication date is uncertain, say “next expected reference observation.”

---

## 9. Frontend and UI/UX specification

### Visual system

Create a polished, restrained financial-data interface: light background, navy text, a single blue accent, quiet borders, consistent spacing and legible numeric typography. Use red/green for movement only alongside labels/icons. Since the pair is INR per USD, a rise means INR weakness and a fall means INR strength. Avoid excessive gradients, glassmorphism, decorative animations and emoji.

### Shell and responsiveness

- Header: CurLens, selected pair, data status/freshness and refresh action.
- Compact navigation and a main content width around 1200px.
- Mobile layout stacks cards/charts, collapses controls and has no horizontal overflow.
- Test at 360px, 768px and 1280px. Ensure keyboard navigation, labels and visible focus states.

### Pages

**Dashboard:** latest published rate + observation date, daily and percentage change, recent chart, rolling volatility, one-step estimate, data-status banner.

**Currency Converter:** amount, from/to selectors, swap button, conversion result, applied reference rate and rate date. Validate numeric input; default to common supported pairs such as USD/INR, EUR/INR and GBP/INR only when present in the API.

**History & Analytics:** interactive chart with 1M/3M/6M/1Y/MAX ranges, daily change and rolling volatility, available range and observation count. Do not draw invented values across gaps.

**Nowcast & Forecast:** separate actual versus estimate; chart includes history, point forecasts and 80%/95% intervals where available; model scorecard by 1/3/5 observation horizons; visible disclaimer. These are rate-observation steps, not guaranteed calendar dates.

**Methodology:** source and link, pair direction, update limitation, model definitions, rolling-origin test method, metrics and limitations. State that daily reference rates are not live quotes; historical one-step backtesting is not intraday nowcasting; past performance is not a guarantee.

### States

Every data-driven page must support loading, success, empty/error and stale-cache states. Disable repeated refresh clicks while loading. Preserve valid cached data after a failed refresh. Do not freeze the whole UI while evaluation runs; cache results and show progress/status.

---

## 10. Local commands and developer experience

Document install/run steps in `README.md` for Windows PowerShell and macOS/Linux where practical.

### Backend

1. Install R: <https://cran.r-project.org/>.
2. From `backend/`, run `Rscript install_packages.R` once.
3. Start Plumber with a documented command such as:
   `Rscript -e "plumber::plumb('plumber.R')$run(host='127.0.0.1', port=8000)"`
4. Verify `http://127.0.0.1:8000/api/health`.

Verify the Plumber invocation against the installed version and make the working-directory requirement explicit in README.

### Frontend

1. Install Node.js LTS: <https://nodejs.org/>.
2. From `frontend/`, run `npm install` then `npm run dev`.
3. Configure one `VITE_API_BASE_URL` with a local default; no secrets belong in frontend variables.

Prefer Vite proxying `/api` to `127.0.0.1:8000` to simplify local CORS. Keep deployment optional and out of scope until local acceptance criteria pass.

---

## 11. Antigravity prompts — run one at a time

Open the project root and paste **one prompt at a time**. Test the acceptance criteria before advancing.

### Phase 0 — Plan only
> Read `DESIGN.md` fully and inspect the workspace and installed R/Node setup. Do not implement yet. Return a concise Phase 1 checklist and exact validation commands. Do not expand scope or add dependencies.

### Phase 1 — Skeleton
> Implement only the project skeleton, minimal React/Vite app, Plumber health route, `.gitignore` and README run instructions. Do not build models or the full UI. Run syntax/build checks and report exact commands/results. Do not modify `DESIGN.md`.

Acceptance: frontend starts, backend starts and `/api/health` returns JSON.

### Phase 2 — Data and cache
> Implement only Frankfurter v2 ingestion and the CSV cache from Sections 2 and 6. Verify the API schema with one small request first. Add timeout/status checks, validation, deduplication, atomic writes, refresh overlap and stale-cache fallback. Do not build models/UI. Test live if network is available; otherwise mark the test as not run and use a clearly labelled fixture—never pretend a fixture is live.

Acceptance: initial history download works; refresh merges updates; cache remains usable offline; rows are valid and unique by date.

### Phase 3 — Analytics and evaluation
> Implement only functions in Section 8: metrics, random-walk baseline, ARIMA on log rates, one-step estimate, 1/3/5-observation forecasts and rolling-origin evaluation. Limit to about 30–50 origins. No random shuffling or data leakage. Add small tests for validation, horizons, conversion arithmetic and metrics. Do not build UI.

Acceptance: models run on real cached data, baseline works if ARIMA fails, and metrics come from chronological tests.

### Phase 4 — API routes
> Add the endpoints in Section 7 using existing functions. Validate query input, keep JSON schemas consistent, and avoid refetching on every request. Test routes with curl or the R smoke test; list actual results. Do not implement frontend pages.

Acceptance: health, currencies, latest, history, conversion, analytics, nowcast, forecast and evaluation return correct responses/errors.

### Phase 5 — Frontend
> Implement the React pages and styles in Section 9. Use Recharts and one API module (`src/services/api.js`); components must not call Frankfurter directly. Use genuine API output, clear loading/error/stale states and honest rate/forecast labels. Do not add login, heavy UI libraries or unrequested features.

Acceptance: all pages work with the backend, converter validates input, filters update charts, missing intervals are handled, and mobile has no horizontal overflow.

### Phase 6 — Integration QA
> Run a targeted end-to-end check against `DESIGN.md`. Fix only acceptance-blocking bugs. Test API routes, frontend build, offline cache, invalid inputs, forecasts, status states and layouts at 360/768/1280px. Do not restructure working code or add features. Update README with verified commands, actual results and limitations. Explicitly state anything not tested.

Acceptance: a new user can follow README from a clean checkout and run the app; features and caveats are documented.

---

## 12. Definition of done

- [ ] Real Frankfurter v2 history fetched and actual date coverage recorded.
- [ ] Local cache and refresh logic work; API failure does not erase valid cached data.
- [ ] Latest rate, observation date and fetch timestamp are distinct.
- [ ] Currency conversion works with validation and supported pairs.
- [ ] Dashboard and historical charts display actual rates.
- [ ] One-step estimate is labelled as a model estimate, not a live quote.
- [ ] 1/3/5-observation forecasts and prediction intervals work when the model supports them.
- [ ] Rolling-origin backtest compares random-walk baseline and ARIMA without leakage.
- [ ] MAE/RMSE are shown by horizon and model; metrics are not fabricated.
- [ ] API and UI have loading, stale, error and empty states.
- [ ] Responsive layout verified at 360px, 768px and 1280px.
- [ ] README has verified install/run/test commands and data/model limitations.
- [ ] No unrelated features or unnecessary dependencies were added.

---

## 13. Useful references

- Antigravity pricing: <https://antigravity.google/pricing>
- Antigravity plans and quota behavior: <https://antigravity.google/docs/plans>
- Frankfurter API docs: <https://frankfurter.dev/docs>
- Frankfurter historical rates and API examples: <https://frankfurter.dev/>
- R `forecast` package: <https://pkg.robjhyndman.com/forecast/>
- Plumber documentation: <https://www.rplumber.io/>
- Vite guide: <https://vite.dev/guide/>
- Recharts: <https://recharts.org/>

**Final instruction to the coding agent:** prioritize a complete, tested vertical slice over breadth. Never make a chart look complete by generating fake data. If an endpoint, model fit or test cannot be verified, state that explicitly and keep the project runnable with a clear fallback.
