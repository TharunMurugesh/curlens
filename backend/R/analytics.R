suppressPackageStartupMessages({
  library(dplyr)
  library(tibble)
})

compute_rate_series_metrics <- function(rates_df, vol_window = 30) {
  if (is.null(rates_df) || nrow(rates_df) == 0) {
    return(data.frame())
  }
  
  df <- rates_df[order(rates_df$date), ]
  n <- nrow(df)
  
  rates <- df$rate
  dates <- df$date
  
  lag_rate <- c(NA, rates[-n])
  
  abs_change <- rates - lag_rate
  pct_change <- (abs_change / lag_rate) * 100
  log_return <- c(NA, diff(log(rates)))
  
  rolling_vol <- rep(NA_real_, n)
  rolling_vol_ann <- rep(NA_real_, n)
  
  if (n >= vol_window) {
    for (i in vol_window:n) {
      window_rets <- log_return[(i - vol_window + 1):i]
      window_rets <- window_rets[!is.na(window_rets)]
      if (length(window_rets) >= (vol_window - 2)) {
        s <- sd(window_rets)
        rolling_vol[i] <- s
        rolling_vol_ann[i] <- s * sqrt(252) * 100
      }
    }
  }
  
  data.frame(
    date = dates,
    rate = rates,
    abs_change = round(abs_change, 4),
    pct_change = round(pct_change, 4),
    log_return = round(log_return, 6),
    rolling_volatility = round(rolling_vol, 6),
    annualized_volatility = round(rolling_vol_ann, 2),
    stringsAsFactors = FALSE
  )
}

calculate_summary_metrics <- function(rates_df, vol_window = 30) {
  if (is.null(rates_df) || nrow(rates_df) == 0) {
    return(list(error = "Empty series"))
  }
  
  enriched <- compute_rate_series_metrics(rates_df, vol_window = vol_window)
  n <- nrow(enriched)
  latest <- enriched[n, ]
  prev <- if (n > 1) enriched[n - 1, ] else latest
  
  rates <- enriched$rate
  
  list(
    observation_count = n,
    start_date = min(enriched$date),
    end_date = max(enriched$date),
    latest_rate = latest$rate,
    latest_date = latest$date,
    previous_rate = prev$rate,
    previous_date = prev$date,
    daily_change = latest$abs_change,
    daily_pct_change = latest$pct_change,
    period_min = min(rates, na.rm = TRUE),
    period_max = max(rates, na.rm = TRUE),
    period_mean = round(mean(rates, na.rm = TRUE), 4),
    period_median = round(median(rates, na.rm = TRUE), 4),
    volatility_window = vol_window,
    latest_rolling_volatility = latest$rolling_volatility,
    latest_annualized_volatility = latest$annualized_volatility,
    volatility_formula = "Sample standard deviation of daily log returns over rolling 30 business observations (annualized using sqrt(252))"
  )
}

calculate_mae <- function(actual, predicted) {
  valid <- !is.na(actual) & !is.na(predicted)
  if (sum(valid) == 0) return(NA_real_)
  mean(abs(actual[valid] - predicted[valid]))
}

calculate_rmse <- function(actual, predicted) {
  valid <- !is.na(actual) & !is.na(predicted)
  if (sum(valid) == 0) return(NA_real_)
  sqrt(mean((actual[valid] - predicted[valid])^2))
}

calculate_directional_accuracy <- function(actual, predicted, baseline_actual) {
  valid <- !is.na(actual) & !is.na(predicted) & !is.na(baseline_actual)
  if (sum(valid) == 0) return(NA_real_)
  actual_dir <- sign(actual[valid] - baseline_actual[valid])
  pred_dir <- sign(predicted[valid] - baseline_actual[valid])
  mean(actual_dir == pred_dir) * 100
}

