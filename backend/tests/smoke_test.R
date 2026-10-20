
suppressPackageStartupMessages({
  library(httr2)
  library(jsonlite)
})

base_url <- "http://127.0.0.1:8000"

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

get_json <- function(path, expect_status = 200) {
  req <- request(paste0(base_url, path)) |>
    req_timeout(15) |>
    req_error(is_error = function(resp) FALSE)
  resp <- req_perform(req)
  
  status <- resp_status(resp)
  assert_true(status == expect_status, sprintf("GET %s returned HTTP %d (expected %d)", path, status, expect_status))
  
  body_text <- resp_body_string(resp)
  fromJSON(body_text)
}

cat("=== CurLens Backend API Smoke Test ===\n\n")

cat("-- Testing /api/health --\n")
h <- get_json("/api/health")
assert_true(h$status == "ok", "/api/health reports status 'ok'")
assert_true(h$cache$available == TRUE, "/api/health reports cache available")
assert_true(as.integer(h$cache$row_count) > 0, sprintf("/api/health row_count > 0 (%s)", h$cache$row_count))

cat("\n-- Testing /api/currencies --\n")
curr <- get_json("/api/currencies")
assert_true(nrow(curr$currencies) > 0, "/api/currencies returns currency list")
iso_codes <- curr$currencies$iso_code
assert_true("USD" %in% iso_codes, "Currencies includes USD")
assert_true("INR" %in% iso_codes, "Currencies includes INR")

cat("\n-- Testing /api/rates/latest --\n")
lat <- get_json("/api/rates/latest?base=USD&quote=INR")
assert_true(lat$base == "USD" && lat$quote == "INR", "Latest rate has correct base/quote")
assert_true(is.numeric(lat$rate) && lat$rate > 0, sprintf("Latest rate is positive numeric (%.4f)", lat$rate))
assert_true(!is.null(lat$date), sprintf("Latest rate date is present (%s)", lat$date))

lat_id <- get_json("/api/rates/latest?base=USD&quote=USD")
assert_true(lat_id$rate == 1.0, "Identity rate USD/USD is 1.0")

lat_err <- get_json("/api/rates/latest?base=INVALID&quote=INR", expect_status = 400)
assert_true(!is.null(lat_err$error) && lat_err$code == "INVALID_PARAMETER", "Invalid currency returned 400 with code INVALID_PARAMETER")

cat("\n-- Testing /api/rates/history --\n")
hist <- get_json("/api/rates/history?base=USD&quote=INR&from=2026-01-01&to=2026-06-01")
assert_true(as.integer(hist$observation_count) > 0, sprintf("History returned %s observations", hist$observation_count))
rates_df <- as.data.frame(hist$rates)
assert_true("rate" %in% names(rates_df), "History rates contain 'rate'")
assert_true("abs_change" %in% names(rates_df), "History rates contain 'abs_change'")

hist_err <- get_json("/api/rates/history?base=USD&quote=INR&from=invalid-date", expect_status = 400)
assert_true(hist_err$code == "INVALID_PARAMETER", "Invalid date format returned 400")

cat("\n-- Testing /api/convert --\n")
conv <- get_json("/api/convert?amount=100&from=USD&to=INR")
assert_true(conv$amount == 100, "Conversion amount is 100")
assert_true(conv$converted_amount > 0, sprintf("Converted amount is positive (%.2f)", conv$converted_amount))
assert_true(abs(conv$converted_amount - (100 * conv$rate)) < 0.1, "Conversion arithmetic is correct")

conv_rev <- get_json("/api/convert?amount=1000&from=INR&to=USD")
assert_true(conv_rev$converted_amount > 0, sprintf("Reverse conversion INR->USD positive (%.2f)", conv_rev$converted_amount))

conv_same <- get_json("/api/convert?amount=50&from=USD&to=USD")
assert_true(conv_same$converted_amount == 50, "Identity conversion returns exact amount")

conv_err <- get_json("/api/convert?amount=-50&from=USD&to=INR", expect_status = 400)
assert_true(conv_err$code == "INVALID_PARAMETER", "Negative conversion amount returned 400")

cat("\n-- Testing /api/analytics --\n")
an <- get_json("/api/analytics?window=30")
assert_true(an$pair == "USD/INR", "Analytics pair is USD/INR")
assert_true(!is.null(an$latest_rolling_volatility), "Rolling volatility is computed")
assert_true(is.numeric(an$period_mean) && an$period_mean > 0, sprintf("Period mean is positive (%.4f)", an$period_mean))

cat("\n-- Testing /api/nowcast --\n")
nc <- get_json("/api/nowcast")
assert_true(nc$target_pair == "USD/INR", "Nowcast targets USD/INR")
assert_true(nc$horizon_observations == 1, "Nowcast horizon is 1 observation")
assert_true(is.numeric(nc$arima_estimate) && nc$arima_estimate > 0, sprintf("Nowcast ARIMA estimate is positive (%.4f)", nc$arima_estimate))
assert_true(is.numeric(nc$baseline_estimate) && nc$baseline_estimate > 0, sprintf("Nowcast baseline estimate is positive (%.4f)", nc$baseline_estimate))
assert_true(!is.null(nc$arima_intervals$lower_80), "Nowcast contains 80% intervals")
assert_true(!is.null(nc$disclaimer), "Nowcast contains disclaimer")

cat("\n-- Testing /api/forecast --\n")
fc <- get_json("/api/forecast?horizons=1,3,5")
horizons_df <- as.data.frame(fc$horizons)
assert_true(nrow(horizons_df) == 3, "Forecast returned 3 horizons")
assert_true(horizons_df$horizon_observations[1] == 1, "First horizon is 1")
assert_true(horizons_df$baseline$prediction[1] > 0, "Baseline prediction is positive")
assert_true(horizons_df$arima$prediction[1] > 0, "ARIMA prediction is positive")
assert_true(as.numeric(horizons_df$arima$lower_80[[1]]) < as.numeric(horizons_df$arima$upper_80[[1]]), "ARIMA interval ordered")

cat("\n-- Testing /api/evaluation --\n")
ev <- get_json("/api/evaluation")
scorecard_df <- as.data.frame(ev$scorecard)
assert_true(nrow(scorecard_df) == 3, "Evaluation scorecard has 3 horizons")
assert_true(as.integer(scorecard_df$horizon_observations[[1]]) == 1, "Scorecard horizon 1 exists")
rw_mae_1 <- as.numeric(scorecard_df$random_walk$mae[[1]])
ar_mae_1 <- as.numeric(scorecard_df$arima$mae[[1]])
assert_true(rw_mae_1 > 0, sprintf("RW MAE > 0 (%.4f)", rw_mae_1))
assert_true(ar_mae_1 > 0, sprintf("ARIMA MAE > 0 (%.4f)", ar_mae_1))

cat(sprintf("\n=== Smoke Test Summary: %d tests, %d failures ===\n", test_count, fail_count))
if (fail_count > 0) {
  quit(status = 1)
} else {
  cat("All API endpoints passed smoke testing!\n")
}
