# CurLens - Plumber API
#* @apiTitle CurLens API
#* @apiDescription R backend API for CurLens currency analytics

source("R/config.R")
source("R/validation.R")
source("R/frankfurter_client.R")
source("R/rate_store.R")
source("R/analytics.R")
source("R/models.R")

# In-memory cache for currencies to avoid external calls on every request
CACHED_CURRENCIES <- NULL
CACHED_CURRENCIES_TIME <- NULL

# Helper for JSON error response
send_error <- function(res, code, message, http_status = 400) {
  res$status <- http_status
  list(
    error = message,
    code = code,
    timestamp = format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  )
}

#* Enable CORS for local development
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

#* Health check endpoint
#* @get /api/health
#* @serializer json
function(res) {
  cache_file <- CONFIG$cache_file
  cache_exists <- file.exists(cache_file)
  row_count <- 0
  last_date <- NULL
  
  if (cache_exists) {
    tryCatch({
      df <- read.csv(cache_file, stringsAsFactors = FALSE)
      row_count <- nrow(df)
      if (row_count > 0 && "date" %in% names(df)) {
        last_date <- max(df$date, na.rm = TRUE)
      }
    }, error = function(e) {})
  }
  
  list(
    status = "ok",
    service = "curlens-api",
    version = "0.1.0",
    timestamp = format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ"),
    cache = list(
      available = cache_exists && row_count > 0,
      row_count = row_count,
      last_date = last_date,
      path = cache_file
    )
  )
}

#* Supported currencies (curated subset verified against Frankfurter)
#* @get /api/currencies
#* @serializer json
function(res) {
  now <- Sys.time()
  if (is.null(CACHED_CURRENCIES) || is.null(CACHED_CURRENCIES_TIME) || 
      as.numeric(difftime(now, CACHED_CURRENCIES_TIME, units = "hours")) > 24) {
    live_df <- tryCatch({
      fetch_currencies()
    }, error = function(e) {
      NULL
    })
    
    if (!is.null(live_df) && nrow(live_df) > 0) {
      CACHED_CURRENCIES <<- live_df
      CACHED_CURRENCIES_TIME <<- now
    }
  }
  
  if (is.null(CACHED_CURRENCIES)) {
    # Fallback to standard curated list if network failed
    curated <- data.frame(
      iso_code = CONFIG$curated_currencies,
      name = c("US Dollar", "Indian Rupee", "Euro", "British Pound", "Japanese Yen",
               "Australian Dollar", "Canadian Dollar", "Swiss Franc", "Chinese Yuan",
               "Singapore Dollar", "UAE Dirham"),
      symbol = c("$", "₹", "€", "£", "¥", "A$", "C$", "CHF", "¥", "S$", "د.إ"),
      stringsAsFactors = FALSE
    )
    return(list(
      currencies = curated,
      status = "fallback",
      disclaimer = "Using curated fallback currency list (Frankfurter offline)."
    ))
  }
  
  # Filter against curated list
  available_codes <- CACHED_CURRENCIES$iso_code
  curated_codes <- intersect(CONFIG$curated_currencies, available_codes)
  filtered <- CACHED_CURRENCIES[CACHED_CURRENCIES$iso_code %in% curated_codes, ]
  
  # Add symbols if missing
  symbols_map <- c(USD = "$", INR = "₹", EUR = "€", GBP = "£", JPY = "¥", 
                   AUD = "A$", CAD = "C$", CHF = "CHF", CNY = "¥", SGD = "S$", AED = "د.إ")
  if (!("symbol" %in% names(filtered))) {
    filtered$symbol <- symbols_map[filtered$iso_code]
  }
  
  list(
    currencies = filtered,
    status = "fresh",
    total_count = nrow(filtered)
  )
}

#* Latest published exchange rate
#* @get /api/rates/latest
#* @param base Base currency (default: USD)
#* @param quote Quote currency (default: INR)
#* @param refresh Force network refresh (default: false)
#* @serializer json
function(base = "USD", quote = "INR", refresh = FALSE, res) {
  base <- toupper(trimws(base))
  quote <- toupper(trimws(quote))
  
  if (!validate_currency_code(base) || !validate_currency_code(quote)) {
    return(send_error(res, "INVALID_PARAMETER", "Invalid 3-letter currency code", 400))
  }
  
  if (base == quote) {
    now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
    return(list(
      base = base,
      quote = quote,
      rate = 1.0,
      date = format(Sys.Date(), "%Y-%m-%d"),
      fetched_at = now_utc,
      data_status = "identity",
      disclaimer = "Identical base and quote currencies return rate 1.0."
    ))
  }
  
  # Primary pair USD/INR uses local store
  if (base == CONFIG$default_base && quote == CONFIG$default_quote) {
    do_refresh <- isTRUE(as.logical(refresh))
    store_res <- tryCatch({
      get_rates_store(base, quote, force_refresh = do_refresh)
    }, error = function(e) {
      NULL
    })
    
    if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
      return(send_error(res, "DATA_UNAVAILABLE", "Failed to retrieve USD/INR rates from cache or API", 503))
    }
    
    df <- store_res$data
    latest_row <- df[nrow(df), ]
    prev_row <- if (nrow(df) > 1) df[nrow(df) - 1, ] else latest_row
    
    abs_chg <- round(latest_row$rate - prev_row$rate, 4)
    pct_chg <- round((abs_chg / prev_row$rate) * 100, 4)
    
    return(list(
      base = base,
      quote = quote,
      rate = latest_row$rate,
      date = latest_row$date,
      previous_rate = prev_row$rate,
      previous_date = prev_row$date,
      daily_change = abs_chg,
      daily_pct_change = pct_chg,
      fetched_at = store_res$last_fetched,
      data_status = store_res$status,
      disclaimer = "Daily published reference rate from Frankfurter v2. Not a live trading quote."
    ))
  }
  
  # For other pairs, query live API directly
  live_rate <- tryCatch({
    fetch_latest_rate(base, quote)
  }, error = function(e) {
    NULL
  })
  
  if (is.null(live_rate)) {
    return(send_error(res, "DATA_UNAVAILABLE", paste("Could not fetch rate for", base, "/", quote), 503))
  }
  
  list(
    base = live_rate$base,
    quote = live_rate$quote,
    rate = live_rate$rate,
    date = live_rate$date,
    fetched_at = live_rate$fetched_at,
    data_status = "live",
    disclaimer = "Daily published reference rate from Frankfurter v2. Not a live trading quote."
  )
}

#* Historical exchange rates
#* @get /api/rates/history
#* @param base Base currency (default: USD)
#* @param quote Quote currency (default: INR)
#* @param from Start date YYYY-MM-DD
#* @param to End date YYYY-MM-DD
#* @serializer json
function(base = "USD", quote = "INR", from = NULL, to = NULL, res) {
  base <- toupper(trimws(base))
  quote <- toupper(trimws(quote))
  
  if (!validate_currency_code(base) || !validate_currency_code(quote)) {
    return(send_error(res, "INVALID_PARAMETER", "Invalid 3-letter currency code", 400))
  }
  
  if (!is.null(from) && nzchar(from) && !validate_date_string(from)) {
    return(send_error(res, "INVALID_PARAMETER", "Invalid 'from' date format (must be YYYY-MM-DD)", 400))
  }
  if (!is.null(to) && nzchar(to) && !validate_date_string(to)) {
    return(send_error(res, "INVALID_PARAMETER", "Invalid 'to' date format (must be YYYY-MM-DD)", 400))
  }
  
  # Retrieve USD/INR history from local store
  if (base == CONFIG$default_base && quote == CONFIG$default_quote) {
    store_res <- tryCatch({
      get_rates_store(base, quote)
    }, error = function(e) {
      NULL
    })
    
    if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
      return(send_error(res, "DATA_UNAVAILABLE", "Historical data unavailable", 503))
    }
    
    df <- store_res$data
    
    if (!is.null(from) && nzchar(from)) {
      df <- df[df$date >= from, ]
    }
    if (!is.null(to) && nzchar(to)) {
      df <- df[df$date <= to, ]
    }
    
    # Calculate enriched metrics for history (abs_change, pct_change, rolling_volatility)
    enriched <- compute_rate_series_metrics(df, vol_window = 30)
    
    return(list(
      base = base,
      quote = quote,
      from = if (!is.null(from) && nzchar(from)) from else min(df$date),
      to = if (!is.null(to) && nzchar(to)) to else max(df$date),
      observation_count = nrow(df),
      rates = enriched,
      data_status = store_res$status,
      disclaimer = "Daily reference rates. Weekend and holiday gaps are normal non-publishing days."
    ))
  }
  
  # Other pairs: fetch from live API
  start_dt <- if (!is.null(from) && nzchar(from)) from else CONFIG$default_start_date
  live_df <- tryCatch({
    fetch_historical_rates(base, quote, from_date = start_dt, to_date = to)
  }, error = function(e) {
    NULL
  })
  
  if (is.null(live_df) || nrow(live_df) == 0) {
    return(send_error(res, "DATA_UNAVAILABLE", "Historical rates could not be retrieved", 503))
  }
  
  enriched <- compute_rate_series_metrics(live_df, vol_window = 30)
  list(
    base = base,
    quote = quote,
    from = min(live_df$date),
    to = max(live_df$date),
    observation_count = nrow(live_df),
    rates = enriched,
    data_status = "live",
    disclaimer = "Daily reference rates. Weekend and holiday gaps are normal non-publishing days."
  )
}

#* Currency conversion endpoint
#* @get /api/convert
#* @param amount Amount to convert
#* @param from Source currency code
#* @param to Target currency code
#* @serializer json
function(amount = 100, from = "USD", to = "INR", res) {
  from <- toupper(trimws(from))
  to <- toupper(trimws(to))
  
  if (!validate_currency_code(from) || !validate_currency_code(to)) {
    return(send_error(res, "INVALID_PARAMETER", "Invalid currency codes", 400))
  }
  
  if (!validate_amount(amount)) {
    return(send_error(res, "INVALID_PARAMETER", "Amount must be a finite non-negative number", 400))
  }
  
  num_amount <- as.numeric(amount)
  
  if (from == to) {
    return(list(
      amount = num_amount,
      from = from,
      to = to,
      rate = 1.0,
      converted_amount = num_amount,
      rate_date = format(Sys.Date(), "%Y-%m-%d"),
      disclaimer = "Identical currency conversion. Reference rate calculation only."
    ))
  }
  
  # For USD to INR or INR to USD: check cache first
  pair_rate <- NULL
  rate_date <- NULL
  
  if (from == "USD" && to == "INR") {
    store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
    if (!is.null(store_res) && nrow(store_res$data) > 0) {
      latest_row <- store_res$data[nrow(store_res$data), ]
      pair_rate <- latest_row$rate
      rate_date <- latest_row$date
    }
  } else if (from == "INR" && to == "USD") {
    store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
    if (!is.null(store_res) && nrow(store_res$data) > 0) {
      latest_row <- store_res$data[nrow(store_res$data), ]
      pair_rate <- 1.0 / latest_row$rate
      rate_date <- latest_row$date
    }
  }
  
  # If not cached or another pair, fetch from Frankfurter
  if (is.null(pair_rate)) {
    live_info <- tryCatch({
      fetch_latest_rate(from, to)
    }, error = function(e) {
      NULL
    })
    
    if (is.null(live_info)) {
      return(send_error(res, "DATA_UNAVAILABLE", paste("Failed to get rate for", from, "/", to), 503))
    }
    pair_rate <- live_info$rate
    rate_date <- live_info$date
  }
  
  converted <- num_amount * pair_rate
  
  list(
    amount = num_amount,
    from = from,
    to = to,
    rate = round(pair_rate, 6),
    converted_amount = round(converted, 2),
    rate_date = rate_date,
    disclaimer = "Reference-rate conversion from Frankfurter daily published rates; not an executable market or payment provider quote."
  )
}

#* Analytics and summary metrics
#* @get /api/analytics
#* @param window Rolling volatility window (default: 30)
#* @serializer json
function(window = 30, res) {
  win <- suppressWarnings(as.integer(window))
  if (is.na(win) || win < 2 || win > 365) {
    return(send_error(res, "INVALID_PARAMETER", "Window must be an integer between 2 and 365", 400))
  }
  
  store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
  if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
    return(send_error(res, "DATA_UNAVAILABLE", "USD/INR rate series unavailable", 503))
  }
  
  summary_info <- calculate_summary_metrics(store_res$data, vol_window = win)
  summary_info$pair <- "USD/INR"
  summary_info$data_status <- store_res$status
  summary_info$last_fetched <- store_res$last_fetched
  
  summary_info
}

#* Nowcast: one-step-ahead estimate of the next unpublished reference rate
#* @get /api/nowcast
#* @serializer json
function(res) {
  store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
  if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
    return(send_error(res, "DATA_UNAVAILABLE", "Rate series unavailable for nowcasting", 503))
  }
  
  nowcast_data <- generate_nowcast(store_res$data)
  nowcast_data$data_status <- store_res$status
  nowcast_data
}

#* Multi-horizon forecasts (1, 3, 5 observations)
#* @get /api/forecast
#* @param horizons Comma-separated list of integer observation horizons (e.g. 1,3,5)
#* @serializer json
function(horizons = "1,3,5", res) {
  h_vec <- validate_horizons(horizons)
  if (length(h_vec) == 0) {
    return(send_error(res, "INVALID_PARAMETER", "Horizons must contain positive integers", 400))
  }
  
  store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
  if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
    return(send_error(res, "DATA_UNAVAILABLE", "Rate series unavailable for forecasting", 503))
  }
  
  fc_data <- generate_forecast_response(store_res$data, horizons = h_vec)
  fc_data$data_status <- store_res$status
  fc_data
}

#* Rolling-origin model evaluation scorecard
#* @get /api/evaluation
#* @param refresh Force recalculation of evaluation (default: false)
#* @serializer json
function(refresh = FALSE, res) {
  do_refresh <- isTRUE(as.logical(refresh))
  store_res <- tryCatch(get_rates_store("USD", "INR"), error = function(e) NULL)
  if (is.null(store_res) || is.null(store_res$data) || nrow(store_res$data) == 0) {
    return(send_error(res, "DATA_UNAVAILABLE", "Rate series unavailable for evaluation", 503))
  }
  
  eval_data <- tryCatch({
    run_rolling_origin_evaluation(
      store_res$data, 
      num_origins = 30, 
      test_size = 250, 
      horizons = c(1, 3, 5), 
      force_recompute = do_refresh
    )
  }, error = function(e) {
    NULL
  })
  
  if (is.null(eval_data)) {
    return(send_error(res, "EVALUATION_FAILED", "Failed to run rolling-origin evaluation", 500))
  }
  
  eval_data$data_status <- store_res$status
  eval_data
}
