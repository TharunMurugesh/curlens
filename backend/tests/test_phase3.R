# CurLens - Phase 3 Analytics & Model Tests

source("R/config.R")
source("R/validation.R")
source("R/rate_store.R")
source("R/analytics.R")
source("R/models.R")

test_count <- 0
fail_count <- 0

assert_true <- function(condition, desc) {
  test_count <<- test_count + 1
  if (isTRUE(condition)) {
    cat(sprintf("[PASS] %s\n", desc))
  } else {
    fail_count <<- fail_count + 1
    cat(sprintf("[FAIL] %s\n", desc))
  }
}

cat("=== Starting Phase 3 Analytics & Metric Tests ===\n")

# 1. Test MAE and RMSE with known mathematical test cases
actual_known <- c(10.0, 12.0, 14.0)
pred_known <- c(9.0, 12.0, 16.0)

mae_val <- calculate_mae(actual_known, pred_known)
rmse_val <- calculate_rmse(actual_known, pred_known)

assert_true(abs(mae_val - 1.0) < 1e-6, sprintf("MAE calculated correctly on known case: expected 1.0, got %f", mae_val))
assert_true(abs(rmse_val - sqrt(5/3)) < 1e-6, sprintf("RMSE calculated correctly on known case: expected %f, got %f", sqrt(5/3), rmse_val))

# Directional accuracy test
base_known <- c(9.5, 11.5, 14.5)
# actual direction: 10 > 9.5 (+), 12 > 11.5 (+), 14 < 14.5 (-)
# pred direction:   9 < 9.5 (-), 12 > 11.5 (+), 16 > 14.5 (+)
# matches: 1 out of 3 = 33.33%
dir_acc <- calculate_directional_accuracy(actual_known, pred_known, base_known)
assert_true(abs(dir_acc - 100/3) < 0.1, "Directional accuracy calculated correctly on known case")

# 2. Rate transformations and rolling volatility test
sample_df <- data.frame(
  date = sprintf("2026-01-%02d", 1:35),
  base = rep("USD", 35),
  quote = rep("INR", 35),
  rate = 80 + cumsum(c(0, rnorm(34, mean = 0.05, sd = 0.2))),
  fetched_at = rep("2026-01-35T00:00:00Z", 35),
  stringsAsFactors = FALSE
)

metrics_df <- compute_rate_series_metrics(sample_df, vol_window = 30)
assert_true(nrow(metrics_df) == 35, "Enriched metrics have same row count as input")
assert_true(is.na(metrics_df$rolling_volatility[1]), "First rolling volatility is NA (insufficient window)")
assert_true(!is.na(metrics_df$rolling_volatility[35]), "Observation 35 has valid rolling volatility")
assert_true(metrics_df$rolling_volatility[35] > 0, "Rolling volatility is positive")

summary_res <- calculate_summary_metrics(sample_df, vol_window = 30)
assert_true(summary_res$observation_count == 35, "Summary observation count is 35")
assert_true(summary_res$latest_rate == metrics_df$rate[35], "Summary reports correct latest rate")

cat("\n=== Starting Phase 3 Modeling Tests ===\n")

# 3. Random Walk Baseline
rates_vec <- sample_df$rate
rw_fc <- predict_random_walk(rates_vec, horizons = c(1, 3, 5))
assert_true(length(rw_fc) == 3, "Random walk generated 3 horizons")
assert_true(rw_fc[["1"]]$prediction == round(rates_vec[35], 4), "Random walk prediction equals latest rate")
assert_true(rw_fc[["1"]]$lower_80 < rw_fc[["1"]]$prediction, "RW lower 80 interval is below prediction")
assert_true(rw_fc[["1"]]$upper_80 > rw_fc[["1"]]$prediction, "RW upper 80 interval is above prediction")
assert_true(rw_fc[["1"]]$lower_95 <= rw_fc[["1"]]$lower_80, "RW 95% interval encompasses 80% interval")

# 4. ARIMA Fallback on Short Series
short_rates <- rates_vec[1:10] # only 10 observations (< 30)
short_arima <- predict_arima(short_rates, horizons = c(1, 3, 5))
assert_true(short_arima[["1"]]$fallback_used == TRUE, "ARIMA safely falls back to baseline when history is short (<30)")

# 5. ARIMA on Real Cached Data
real_cache <- load_cache(CONFIG$cache_file)
assert_true(!is.null(real_cache) && nrow(real_cache) >= 1000, "Loaded genuine cached USD/INR data")

real_rates <- real_cache$rate
arima_fc <- predict_arima(real_rates, horizons = c(1, 3, 5))
assert_true(length(arima_fc) == 3, "ARIMA generated forecasts for horizons 1, 3, 5")
assert_true(is.numeric(arima_fc[["1"]]$prediction) && is.finite(arima_fc[["1"]]$prediction), "ARIMA h=1 prediction is finite numeric")
assert_true(arima_fc[["1"]]$prediction > 0, "ARIMA h=1 prediction is positive")
assert_true(arima_fc[["1"]]$lower_80 < arima_fc[["1"]]$upper_80, "ARIMA 80% bounds are strictly ordered")
assert_true(arima_fc[["1"]]$lower_95 <= arima_fc[["1"]]$lower_80, "ARIMA 95% bounds encompass 80% bounds")

# 6. Nowcast Generation
nowcast_res <- generate_nowcast(real_cache)
assert_true(nowcast_res$target_pair == "USD/INR", "Nowcast targets USD/INR")
assert_true(nowcast_res$horizon_observations == 1, "Nowcast horizon is 1 observation")
assert_true(nowcast_res$arima_estimate == arima_fc[["1"]]$prediction, "Nowcast shares horizon 1 ARIMA forecast")
assert_true(grepl("statistical estimate", nowcast_res$disclaimer), "Nowcast includes honest statistical disclosure")

# 7. Rolling-Origin Backtesting (approx 30 origins)
cat("\nRunning Rolling-Origin Backtest on held-out test set (30 origins)...\n")
t0 <- Sys.time()
eval_res <- run_rolling_origin_evaluation(real_cache, num_origins = 30, test_size = 250, force_recompute = TRUE)
elapsed <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
cat(sprintf("Rolling-origin evaluation completed in %.2f seconds.\n", elapsed))

assert_true(eval_res$origins_evaluated >= 25 && eval_res$origins_evaluated <= 35, "Evaluated ~30 origins")
assert_true(length(eval_res$scorecard) == 3, "Scorecard contains 3 horizons (1, 3, 5)")

for (sc in eval_res$scorecard) {
  h <- sc$horizon_observations
  assert_true(is.finite(sc$random_walk$mae) && sc$random_walk$mae > 0, sprintf("RW h=%d MAE is finite and positive (%f)", h, sc$random_walk$mae))
  assert_true(is.finite(sc$random_walk$rmse) && sc$random_walk$rmse > 0, sprintf("RW h=%d RMSE is finite and positive (%f)", h, sc$random_walk$rmse))
  assert_true(is.finite(sc$arima$mae) && sc$arima$mae > 0, sprintf("ARIMA h=%d MAE is finite and positive (%f)", h, sc$arima$mae))
  assert_true(is.finite(sc$arima$rmse) && sc$arima$rmse > 0, sprintf("ARIMA h=%d RMSE is finite and positive (%f)", h, sc$arima$rmse))
  cat(sprintf("Horizon %d: RW MAE=%.4f RMSE=%.4f | ARIMA MAE=%.4f RMSE=%.4f (Improvement MAE: %.2f%%)\n",
              h, sc$random_walk$mae, sc$random_walk$rmse, sc$arima$mae, sc$arima$rmse, sc$arima_improvement_mae_pct))
}

# 8. Evaluation Cache Verification
eval_cache_file <- file.path(CONFIG$cache_dir, "evaluation_usd_inr.rds")
assert_true(file.exists(eval_cache_file), "Evaluation results cached to disk")
t_cache0 <- Sys.time()
eval_cached_read <- run_rolling_origin_evaluation(real_cache, num_origins = 30, test_size = 250, force_recompute = FALSE)
elapsed_cache <- as.numeric(difftime(Sys.time(), t_cache0, units = "secs"))
assert_true(elapsed_cache < 0.2, sprintf("Cached evaluation returns immediately (%.4f s)", elapsed_cache))

cat(sprintf("\n=== Phase 3 Summary: %d tests, %d failures ===\n", test_count, fail_count))
if (fail_count > 0) {
  quit(status = 1)
} else {
  cat("All Phase 3 tests passed!\n")
}
