# CurLens - Frankfurter v2 API Client
suppressPackageStartupMessages({
  library(httr2)
  library(jsonlite)
})

# Create base request with headers and timeout
frankfurter_req <- function(endpoint) {
  url <- paste0(CONFIG$api_base_url, endpoint)
  request(url) |>
    req_user_agent("CurLens/0.1.0 (Currency Analytics)") |>
    req_timeout(CONFIG$request_timeout_seconds)
}

# Fetch list of supported currencies
fetch_currencies <- function() {
  req <- frankfurter_req("/currencies")
  resp <- tryCatch({
    req_perform(req)
  }, error = function(e) {
    stop(paste("Failed to connect to Frankfurter API:", e$message))
  })
  
  if (resp_status(resp) != 200) {
    stop(paste("Frankfurter API returned HTTP", resp_status(resp)))
  }
  
  body <- resp_body_json(resp, simplifyVector = TRUE)
  if (is.data.frame(body)) {
    return(body)
  }
  
  # If list of objects
  as.data.frame(body, stringsAsFactors = FALSE)
}

# Fetch single latest rate for a pair
fetch_latest_rate <- function(base = CONFIG$default_base, quote = CONFIG$default_quote) {
  base <- toupper(trimws(base))
  quote <- toupper(trimws(quote))
  
  if (base == quote) {
    today_str <- format(Sys.Date(), "%Y-%m-%d")
    return(list(
      date = today_str,
      base = base,
      quote = quote,
      rate = 1.0,
      fetched_at = format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
    ))
  }
  
  endpoint <- paste0("/rate/", base, "/", quote)
  req <- frankfurter_req(endpoint)
  
  resp <- tryCatch({
    req_perform(req)
  }, error = function(e) {
    stop(paste("Failed to fetch rate:", e$message))
  })
  
  if (resp_status(resp) != 200) {
    stop(paste("Frankfurter API returned HTTP", resp_status(resp)))
  }
  
  data <- resp_body_json(resp)
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  
  list(
    date = as.character(data$date),
    base = as.character(data$base),
    quote = as.character(data$quote),
    rate = as.numeric(data$rate),
    fetched_at = now_utc
  )
}

# Fetch historical time series for a pair
fetch_historical_rates <- function(base = CONFIG$default_base, 
                                   quote = CONFIG$default_quote, 
                                   from_date = CONFIG$default_start_date, 
                                   to_date = NULL) {
  base <- toupper(trimws(base))
  quote <- toupper(trimws(quote))
  
  endpoint <- paste0("/rates?from=", from_date, "&base=", base, "&quotes=", quote)
  if (!is.null(to_date) && nzchar(to_date)) {
    endpoint <- paste0(endpoint, "&to=", to_date)
  }
  
  req <- frankfurter_req(endpoint)
  resp <- tryCatch({
    req_perform(req)
  }, error = function(e) {
    stop(paste("Failed to fetch historical rates:", e$message))
  })
  
  if (resp_status(resp) != 200) {
    stop(paste("Frankfurter API returned HTTP", resp_status(resp)))
  }
  
  body <- resp_body_json(resp, simplifyVector = TRUE)
  if (length(body) == 0 || (is.data.frame(body) && nrow(body) == 0)) {
    return(data.frame(
      date = character(0),
      base = character(0),
      quote = character(0),
      rate = numeric(0),
      fetched_at = character(0),
      stringsAsFactors = FALSE
    ))
  }
  
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  
  df <- as.data.frame(body, stringsAsFactors = FALSE)
  df$date <- as.character(df$date)
  df$base <- as.character(df$base)
  df$quote <- as.character(df$quote)
  df$rate <- as.numeric(df$rate)
  df$fetched_at <- now_utc
  
  # Filter valid rows
  df <- df[!is.na(df$rate) & !is.infinite(df$rate) & df$rate > 0 & !is.na(df$date), ]
  df <- df[order(df$date), ]
  df <- df[!duplicated(df$date), ]
  
  df
}

