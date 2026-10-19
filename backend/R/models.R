# CurLens - Time Series Models & Rolling-Origin Backtesting
suppressPackageStartupMessages({
  library(forecast)
  library(dplyr)
})

# 1. Random Walk Baseline Model
# Forecasts next observations as equal to the latest observed rate
# Prediction intervals based on log-return volatility
predict_random_walk <- function(rates, horizons = c(1, 3, 5)) {
  n <- length(rates)
  if (n == 0) stop("Rates vector is empty")
  
  latest_rate <- rates[n]
  log_returns <- diff(log(rates))
  sigma <- if (length(log_returns) > 1) sd(log_returns, na.rm = TRUE) else 0.005
  if (is.na(sigma) || sigma <= 0) sigma <- 0.005
  
  res <- list()
  for (h in horizons) {
    # On log scale: se = sigma * sqrt(h)
    se <- sigma * sqrt(h)
    log_pt <- log(latest_rate)
    
    res[[as.character(h)]] <- list(
      model = "random_walk",
      horizon_observations = as.integer(h),
      prediction = round(latest_rate, 4),
      lower_80 = round(exp(log_pt - 1.2816 * se), 4),
      upper_80 = round(exp(log_pt + 1.2816 * se), 4),
      lower_95 = round(exp(log_pt - 1.96 * se), 4),
      upper_95 = round(exp(log_pt + 1.96 * se), 4),
      fallback_used = FALSE
    )
  }
  res
}

# 2. ARIMA Model on log exchange rates
# Uses auto.arima on log(rates), then exponentiates point forecasts and intervals
predict_arima <- function(rates, horizons = c(1, 3, 5)) {
  n <- length(rates)
  if (n < 30) {
    # History too short, fall back to random walk
    rw <- predict_random_walk(rates, horizons)
    for (k in names(rw)) {
      rw[[k]]$model <- "arima (fallback to random_walk)"
      rw[[k]]$fallback_used <- TRUE
      rw[[k]]$warning <- "Insufficient historical data for ARIMA (< 30 observations)"
    }
    return(rw)
  }
  
  max_h <- max(horizons)
  log_rates <- log(rates)
  
  fit <- tryCatch({
    forecast::auto.arima(
      log_rates, 
      seasonal = FALSE, 
      stepwise = TRUE, 
      approximation = TRUE,
      allowdrift = TRUE
    )
  }, error = function(e) {
    NULL
  })
  
  if (is.null(fit)) {
    # Fitting failed, fall back safely
    rw <- predict_random_walk(rates, horizons)
    for (k in names(rw)) {
      rw[[k]]$model <- "arima (fallback to random_walk)"
      rw[[k]]$fallback_used <- TRUE
      rw[[k]]$warning <- "auto.arima fitting failed to converge; using baseline"
    }
    return(rw)
  }
  
  fc <- tryCatch({
    forecast::forecast(fit, h = max_h, level = c(80, 95))
  }, error = function(e) {
    NULL
  })
  
  if (is.null(fc)) {
    rw <- predict_random_walk(rates, horizons)
    for (k in names(rw)) {
      rw[[k]]$model <- "arima (fallback to random_walk)"
      rw[[k]]$fallback_used <- TRUE
      rw[[k]]$warning <- "ARIMA forecast generation failed; using baseline"
    }
    return(rw)
  }
  
  model_order <- forecast::arimaorder(fit)
  model_desc <- sprintf("ARIMA(%d,%d,%d)", model_order[1], model_order[2], model_order[3])
  
  res <- list()
  for (h in horizons) {
    idx <- as.integer(h)
    pt <- exp(as.numeric(fc$mean[idx]))
    l80 <- exp(as.numeric(fc$lower[idx, 1]))
    u80 <- exp(as.numeric(fc$upper[idx, 1]))
    l95 <- exp(as.numeric(fc$lower[idx, 2]))
    u95 <- exp(as.numeric(fc$upper[idx, 2]))
    
    res[[as.character(h)]] <- list(
      model = "arima",
      model_specification = model_desc,
      horizon_observations = idx,
      prediction = round(pt, 4),
      lower_80 = round(l80, 4),
      upper_80 = round(u80, 4),
      lower_95 = round(l95, 4),
      upper_95 = round(u95, 4),
      fallback_used = FALSE
    )
  }
  res
}

# 3. Nowcast (One-step-ahead estimate)
# Produced from data through current date; shares the 1-observation ARIMA forecast
generate_nowcast <- function(rates_df) {
  if (is.null(rates_df) || nrow(rates_df) == 0) {
    stop("No rate data available for nowcasting")
  }
  
  rates <- rates_df$rate
  dates <- rates_df$date
  n <- length(rates)
  
  latest_observed_rate <- rates[n]
  latest_observation_date <- dates[n]
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  
  # Forecast 1 observation ahead
  arima_h1 <- predict_arima(rates, horizons = 1)[[1]]
  rw_h1 <- predict_random_walk(rates, horizons = 1)[[1]]
  
  list(
    target_pair = paste0(CONFIG$default_base, "/", CONFIG$default_quote),
    generated_at = now_utc,
    latest_observation_date = latest_observation_date,
    latest_observed_rate = latest_observed_rate,
    horizon_observations = 1,
    arima_estimate = arima_h1$prediction,
    arima_intervals = list(
      lower_80 = arima_h1$lower_80,
      upper_80 = arima_h1$upper_80,
      lower_95 = arima_h1$lower_95,
      upper_95 = arima_h1$upper_95
    ),
    baseline_estimate = rw_h1$prediction,
    model_name = arima_h1$model,
    model_specification = if (!is.null(arima_h1$model_specification)) arima_h1$model_specification else "Random Walk",
    fallback_used = arima_h1$fallback_used,
    disclaimer = "This is a statistical estimate of the next reference-rate observation, not a live market quote. Frankfurter publishes daily reference rates; this project does not use intraday prices."
  )
}

# 4. Multi-Horizon Forecast Endpoint Generator
generate_forecast_response <- function(rates_df, horizons = c(1, 3, 5)) {
  if (is.null(rates_df) || nrow(rates_df) == 0) {
    stop("No rate data available for forecasting")
  }
  
  rates <- rates_df$rate
  dates <- rates_df$date
  n <- length(rates)
  
  latest_rate <- rates[n]
  latest_date <- dates[n]
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  
  rw_forecasts <- predict_random_walk(rates, horizons)
  arima_forecasts <- predict_arima(rates, horizons)
  
  forecast_list <- list()
  for (h in horizons) {
    h_str <- as.character(h)
    rw_item <- rw_forecasts[[h_str]]
    ar_item <- arima_forecasts[[h_str]]
    
    forecast_list[[length(forecast_list) + 1]] <- list(
      horizon_observations = as.integer(h),
      horizon_label = sprintf("%d %s ahead", h, ifelse(h == 1, "observation", "observations")),
      baseline = rw_item,
      arima = ar_item
    )
  }
  
  list(
    pair = paste0(CONFIG$default_base, "/", CONFIG$default_quote),
    generated_at = now_utc,
    latest_observation_date = latest_date,
    latest_observed_rate = latest_rate,
    horizons = forecast_list,
    disclaimer = "Horizons represent future published rate observations (business days), not guaranteed calendar dates. Rates are reference rates."
  )
}

# 5. Chronological Rolling-Origin Backtesting & Evaluation
# Held-out testing on the latest ~250 observations with 30 evaluation origins
run_rolling_origin_evaluation <- function(rates_df, num_origins = 30, test_size = 250, horizons = c(1, 3, 5), force_recompute = FALSE) {
  cache_file <- file.path(CONFIG$cache_dir, "evaluation_usd_inr.rds")
  
  n <- nrow(rates_df)
  if (n < (test_size + 100)) {
    test_size <- max(30, floor(n * 0.2))
  }
  
  max_date <- max(rates_df$date)
  
  # Check if cached evaluation is available for current latest date
  if (!force_recompute && file.exists(cache_file)) {
    cached_eval <- tryCatch(readRDS(cache_file), error = function(e) NULL)
    if (!is.null(cached_eval) && 
        identical(as.character(cached_eval$latest_observation_date), as.character(max_date)) &&
        isTRUE(as.integer(cached_eval$num_origins) == as.integer(num_origins)) &&
        isTRUE(as.integer(cached_eval$test_size) == as.integer(test_size))) {
      return(cached_eval)
    }
  }
  
  rates <- rates_df$rate
  dates <- rates_df$date
  
  # Held-out test window: start at origin_start_idx up to n - max(horizons)
  max_h <- max(horizons)
  origin_start_idx <- n - test_size
  origin_end_idx <- n - max_h
  
  if (origin_end_idx <= origin_start_idx) {
    origin_start_idx <- max(35, origin_end_idx - num_origins)
  }
  
  total_available_origins <- origin_end_idx - origin_start_idx + 1
  stride <- max(1, floor(total_available_origins / num_origins))
  origins <- seq(origin_start_idx, origin_end_idx, by = stride)
  origins <- origins[1:min(length(origins), num_origins)]
  
  # Tracking evaluation results: list of results per horizon
  results_rw <- list()
  results_arima <- list()
  for (h in horizons) {
    results_rw[[as.character(h)]] <- list(actual = numeric(), pred = numeric(), base_actual = numeric())
    results_arima[[as.character(h)]] <- list(actual = numeric(), pred = numeric(), base_actual = numeric())
  }
  
  # Chronological loop (NO data leakage: fit only on 1:t)
  for (orig in origins) {
    train_rates <- rates[1:orig]
    origin_rate <- rates[orig]
    
    # Fit ARIMA on train_rates only
    rw_pred <- predict_random_walk(train_rates, horizons)
    ar_pred <- predict_arima(train_rates, horizons)
    
    for (h in horizons) {
      target_idx <- orig + h
      if (target_idx <= n) {
        actual_val <- rates[target_idx]
        h_str <- as.character(h)
        
        # RW
        results_rw[[h_str]]$actual <- c(results_rw[[h_str]]$actual, actual_val)
        results_rw[[h_str]]$pred <- c(results_rw[[h_str]]$pred, rw_pred[[h_str]]$prediction)
        results_rw[[h_str]]$base_actual <- c(results_rw[[h_str]]$base_actual, origin_rate)
        
        # ARIMA
        results_arima[[h_str]]$actual <- c(results_arima[[h_str]]$actual, actual_val)
        results_arima[[h_str]]$pred <- c(results_arima[[h_str]]$pred, ar_pred[[h_str]]$prediction)
        results_arima[[h_str]]$base_actual <- c(results_arima[[h_str]]$base_actual, origin_rate)
      }
    }
  }
  
  # Compute metrics for each model and horizon
  scorecard <- list()
  for (h in horizons) {
    h_str <- as.character(h)
    
    rw_h <- results_rw[[h_str]]
    ar_h <- results_arima[[h_str]]
    
    rw_mae <- calculate_mae(rw_h$actual, rw_h$pred)
    rw_rmse <- calculate_rmse(rw_h$actual, rw_h$pred)
    rw_dir <- calculate_directional_accuracy(rw_h$actual, rw_h$pred, rw_h$base_actual)
    
    ar_mae <- calculate_mae(ar_h$actual, ar_h$pred)
    ar_rmse <- calculate_rmse(ar_h$actual, ar_h$pred)
    ar_dir <- calculate_directional_accuracy(ar_h$actual, ar_h$pred, ar_h$base_actual)
    
    scorecard[[length(scorecard) + 1]] <- list(
      horizon_observations = as.integer(h),
      sample_size = length(rw_h$actual),
      random_walk = list(
        mae = round(rw_mae, 4),
        rmse = round(rw_rmse, 4),
        directional_accuracy_pct = round(rw_dir, 1)
      ),
      arima = list(
        mae = round(ar_mae, 4),
        rmse = round(ar_rmse, 4),
        directional_accuracy_pct = round(ar_dir, 1)
      ),
      arima_improvement_mae_pct = round(((rw_mae - ar_mae) / rw_mae) * 100, 2),
      arima_improvement_rmse_pct = round(((rw_rmse - ar_rmse) / rw_rmse) * 100, 2)
    )
  }
  
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  eval_result <- list(
    evaluation_protocol = "Chronological rolling-origin evaluation without data leakage",
    pair = paste0(CONFIG$default_base, "/", CONFIG$default_quote),
    latest_observation_date = max_date,
    evaluated_at = now_utc,
    num_origins = length(origins),
    test_size = test_size,
    origins_evaluated = length(origins),
    held_out_period_start = dates[origin_start_idx],
    held_out_period_end = dates[n],
    scorecard = scorecard,
    notes = "Origins are evaluated strictly sequentially. At each origin t, model fits solely on prior observations (1:t) to predict t+h."
  )
  
  # Cache the evaluation result
  tryCatch({
    saveRDS(eval_result, file = cache_file)
  }, error = function(e) {
    warning("Could not write evaluation cache: ", e$message)
  })
  
  eval_result
}
