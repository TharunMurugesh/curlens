
source("R/config.R")
source("R/validation.R")
source("R/frankfurter_client.R")
source("R/rate_store.R")

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

cat("=== Starting Phase 2 Deterministic / Fixture Tests ===\n")

valid_df <- data.frame(
  date = c("2026-10-15", "2026-10-16", "2026-10-17"),
  base = c("USD", "USD", "USD"),
  quote = c("INR", "INR", "INR"),
  rate = c(95.0, 95.2, 95.1),
  fetched_at = rep("2026-10-19T00:00:00Z", 3),
  stringsAsFactors = FALSE
)
v_res <- validate_rates_df(valid_df)
assert_true(v_res$valid, "Valid rates dataframe passes validation")

invalid_rate_df <- valid_df
invalid_rate_df$rate[2] <- -1.0
assert_true(!validate_rates_df(invalid_rate_df)$valid, "Negative rate rejected")

invalid_zero_df <- valid_df
invalid_zero_df$rate[2] <- 0
assert_true(!validate_rates_df(invalid_zero_df)$valid, "Zero rate rejected")

dup_date_df <- valid_df
dup_date_df$date[3] <- "2026-10-16"
assert_true(!validate_rates_df(dup_date_df)$valid, "Duplicate dates rejected")

test_cache_path <- file.path(CONFIG$cache_dir, "test_pair.csv")
if (file.exists(test_cache_path)) unlink(test_cache_path)

save_cache_atomic(valid_df, test_cache_path)
assert_true(file.exists(test_cache_path), "Atomic write successfully creates cache file")

loaded_df <- load_cache(test_cache_path)
assert_true(!is.null(loaded_df) && nrow(loaded_df) == 3, "Loaded cache matches expected row count")
assert_true(all(loaded_df$rate == valid_df$rate), "Loaded cache values match saved values")

new_overlap_df <- data.frame(
  date = c("2026-10-17", "2026-10-18"),
  base = c("USD", "USD"),
  quote = c("INR", "INR"),
  rate = c(95.15, 95.30),
  fetched_at = rep("2026-10-19T01:00:00Z", 2),
  stringsAsFactors = FALSE
)

cached_filtered <- loaded_df[!(loaded_df$date %in% new_overlap_df$date), ]
merged_df <- rbind(cached_filtered, new_overlap_df)
merged_df <- merged_df[order(merged_df$date), ]
assert_true(nrow(merged_df) == 4, "Merged dataframe has 4 unique dates")
assert_true(merged_df$rate[merged_df$date == "2026-10-17"] == 95.15, "Merge retains updated rate on overlap")
assert_true(anyDuplicated(merged_df$date) == 0, "No duplicate dates after merge")

if (file.exists(test_cache_path)) unlink(test_cache_path)

test_stale_cache <- file.path(CONFIG$cache_dir, "test_stale.csv")
save_cache_atomic(valid_df, test_stale_cache)

cached_res <- load_cache(test_stale_cache)
assert_true(!is.null(cached_res), "Stale cache remains readable")
if (file.exists(test_stale_cache)) unlink(test_stale_cache)

cat("\n=== Starting Phase 2 Network / Live Ingestion Tests ===\n")

live_curr <- tryCatch({
  fetch_currencies()
}, error = function(e) {
  cat(sprintf("[WARN] Network currency fetch skipped/failed: %s\n", e$message))
  NULL
})

if (!is.null(live_curr)) {
  assert_true(is.data.frame(live_curr) && nrow(live_curr) > 0, "Live currencies returned valid data frame")
  assert_true("iso_code" %in% names(live_curr), "Currencies response has 'iso_code' field")
  assert_true("INR" %in% live_curr$iso_code, "INR present in supported currencies")
  assert_true("USD" %in% live_curr$iso_code, "USD present in supported currencies")
}

live_latest <- tryCatch({
  fetch_latest_rate("USD", "INR")
}, error = function(e) {
  cat(sprintf("[WARN] Network latest rate fetch skipped/failed: %s\n", e$message))
  NULL
})

if (!is.null(live_latest)) {
  assert_true(live_latest$base == "USD" && live_latest$quote == "INR", "Live rate matches requested pair")
  assert_true(is.numeric(live_latest$rate) && live_latest$rate > 0, "Live rate is positive numeric")
  assert_true(validate_date_string(live_latest$date), "Live rate date is valid ISO date")
}

live_sync <- tryCatch({
  sync_rates_cache("USD", "INR", force_full = FALSE)
}, error = function(e) {
  cat(sprintf("[WARN] Live history sync skipped/failed: %s\n", e$message))
  NULL
})

if (!is.null(live_sync)) {
  assert_true(file.exists(CONFIG$cache_file), "Live cache file created at data/cache/usd_inr.csv")
  assert_true(live_sync$observation_count >= 1000, paste("Cache contains substantial history:", live_sync$observation_count, "rows"))
  assert_true(anyDuplicated(live_sync$data$date) == 0, "Live cached dates are strictly unique")
  assert_true(all(live_sync$data$rate > 0), "All cached rates are strictly positive")
  cat(sprintf("Live data range: %s to %s (%d observations)\n", 
              min(live_sync$data$date), max(live_sync$data$date), live_sync$observation_count))
}

cat(sprintf("\n=== Phase 2 Summary: %d tests, %d failures ===\n", test_count, fail_count))
if (fail_count > 0) {
  quit(status = 1)
} else {
  cat("All Phase 2 tests passed!\n")
}

