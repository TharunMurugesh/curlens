# CurLens - Validation Helpers

# Validate currency code (ISO 4217 3-letter uppercase)
validate_currency_code <- function(code) {
  if (is.null(code) || !is.character(code) || nchar(trimws(code)) != 3) {
    return(FALSE)
  }
  grepl("^[A-Z]{3}$", toupper(trimws(code)))
}

# Validate date string YYYY-MM-DD
validate_date_string <- function(date_str) {
  if (is.null(date_str) || !is.character(date_str) || nchar(trimws(date_str)) != 10) {
    return(FALSE)
  }
  d <- tryCatch(as.Date(date_str, format = "%Y-%m-%d"), error = function(e) NA)
  !is.na(d) && format(d, "%Y-%m-%d") == date_str
}

# Validate rates data frame:
# Must contain date, base, quote, rate, fetched_at
# Must have positive finite numeric rates and unique dates
validate_rates_df <- function(df) {
  if (!is.data.frame(df) || nrow(df) == 0) {
    return(list(valid = FALSE, message = "Data frame is empty or not a valid data frame"))
  }
  
  required_cols <- c("date", "base", "quote", "rate")
  missing_cols <- setdiff(required_cols, names(df))
  if (length(missing_cols) > 0) {
    return(list(valid = FALSE, message = paste("Missing required columns:", paste(missing_cols, collapse = ", "))))
  }
  
  # Check rates: numeric, positive, finite
  if (!is.numeric(df$rate) || any(is.na(df$rate)) || any(is.infinite(df$rate)) || any(df$rate <= 0)) {
    return(list(valid = FALSE, message = "Rates contain non-positive, non-numeric, NA, or infinite values"))
  }
  
  # Check dates: no NA, unique
  dates <- as.character(df$date)
  if (any(is.na(dates)) || any(dates == "")) {
    return(list(valid = FALSE, message = "Dates contain NA or empty values"))
  }
  
  if (anyDuplicated(dates) > 0) {
    return(list(valid = FALSE, message = "Duplicate dates detected in rates series"))
  }
  
  list(valid = TRUE, message = "Valid rates series")
}

# Validate numeric amount for conversion
validate_amount <- function(amt) {
  if (is.null(amt)) return(FALSE)
  val <- suppressWarnings(as.numeric(amt))
  !is.na(val) && is.finite(val) && val >= 0
}

# Validate integer horizons
validate_horizons <- function(horizons_str) {
  if (is.null(horizons_str)) return(c(1L, 3L, 5L))
  if (is.numeric(horizons_str)) return(as.integer(horizons_str))
  
  parts <- strsplit(as.character(horizons_str), "[, ]+")[[1]]
  nums <- suppressWarnings(as.integer(parts))
  nums <- nums[!is.na(nums) & nums > 0]
  if (length(nums) == 0) c(1L, 3L, 5L) else sort(unique(nums))
}

