
CONFIG <- list(
  api_base_url = "https://api.frankfurter.dev/v2",
  default_base = "USD",
  default_quote = "INR",
  default_start_date = "2015-01-01",
  cache_dir = file.path("data", "cache"),
  cache_file = file.path("data", "cache", "usd_inr.csv"),
  request_timeout_seconds = 15,
  refresh_overlap_days = 7,
  curated_currencies = c("USD", "INR", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SGD", "AED")
)

get_cache_path <- function(base = CONFIG$default_base, quote = CONFIG$default_quote) {
  filename <- paste0(tolower(base), "_", tolower(quote), ".csv")
  file.path(CONFIG$cache_dir, filename)
}

