# CurLens - Rate Store & Cache Manager
suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
})

# Ensure cache directory exists
ensure_cache_dir <- function() {
  if (!dir.exists(CONFIG$cache_dir)) {
    dir.create(CONFIG$cache_dir, recursive = TRUE)
  }
}

# Atomically save data frame to CSV using temp file and rename
save_cache_atomic <- function(df, cache_path) {
  ensure_cache_dir()
  tmp_file <- paste0(cache_path, ".tmp.", as.integer(Sys.time()))
  
  # Format dates as YYYY-MM-DD
  df_to_save <- df
  df_to_save$date <- as.character(df_to_save$date)
  
  write.csv(df_to_save, file = tmp_file, row.names = FALSE)
  
  # Atomic rename
  success <- file.rename(tmp_file, cache_path)
  if (!success) {
    # Fallback to copy and remove
    file.copy(tmp_file, cache_path, overwrite = TRUE)
    unlink(tmp_file)
  }
  invisible(TRUE)
}

# Read cache if it exists and is non-empty
load_cache <- function(cache_path) {
  if (!file.exists(cache_path)) {
    return(NULL)
  }
  
  tryCatch({
    df <- read.csv(cache_path, stringsAsFactors = FALSE)
    if (nrow(df) == 0) return(NULL)
    
    df$date <- as.character(df$date)
    df$rate <- as.numeric(df$rate)
    df$base <- as.character(df$base)
    df$quote <- as.character(df$quote)
    
    val <- validate_rates_df(df)
    if (!val$valid) {
      warning(paste("Cached data invalid:", val$message))
      return(NULL)
    }
    
    df <- df[order(df$date), ]
    df
  }, error = function(e) {
    warning(paste("Error reading cache:", e$message))
    NULL
  })
}

# Sync / Refresh rates with Frankfurter v2 API
# Uses overlap refresh and atomic cache write
# Falls back to stale cache if network fails
sync_rates_cache <- function(base = CONFIG$default_base, 
                             quote = CONFIG$default_quote, 
                             force_full = FALSE) {
  cache_path <- get_cache_path(base, quote)
  cached_df <- load_cache(cache_path)
  
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  
  # Determine fetch start date
  fetch_from <- CONFIG$default_start_date
  if (!force_full && !is.null(cached_df) && nrow(cached_df) > 0) {
    max_date <- max(cached_df$date, na.rm = TRUE)
    overlap_date <- as.Date(max_date) - CONFIG$refresh_overlap_days
    fetch_from <- format(overlap_date, "%Y-%m-%d")
  }
  
  # Attempt network fetch
  fetch_res <- tryCatch({
    fresh_df <- fetch_historical_rates(base = base, quote = quote, from_date = fetch_from)
    list(success = TRUE, data = fresh_df, error = NULL)
  }, error = function(e) {
    list(success = FALSE, data = NULL, error = e$message)
  })
  
  if (fetch_res$success && !is.null(fetch_res$data) && nrow(fetch_res$data) > 0) {
    new_data <- fetch_res$data
    
    if (!is.null(cached_df) && nrow(cached_df) > 0) {
      # Merge: remove overlapping dates from cached_df, append new_data
      cached_filtered <- cached_df[!(cached_df$date %in% new_data$date), ]
      combined_df <- rbind(cached_filtered, new_data)
    } else {
      combined_df <- new_data
    }
    
    # Sort and ensure uniqueness
    combined_df <- combined_df[order(combined_df$date), ]
    combined_df <- combined_df[!duplicated(combined_df$date), ]
    
    # Validate before saving
    val <- validate_rates_df(combined_df)
    if (val$valid) {
      save_cache_atomic(combined_df, cache_path)
      return(list(
        data = combined_df,
        status = "fresh",
        stale = FALSE,
        last_fetched = now_utc,
        last_observation_date = max(combined_df$date),
        observation_count = nrow(combined_df),
        error = NULL
      ))
    }
  }
  
  # If fetch failed or returned invalid data, fall back to cache
  if (!is.null(cached_df) && nrow(cached_df) > 0) {
    return(list(
      data = cached_df,
      status = "stale",
      stale = TRUE,
      last_fetched = if ("fetched_at" %in% names(cached_df)) max(cached_df$fetched_at) else now_utc,
      last_observation_date = max(cached_df$date),
      observation_count = nrow(cached_df),
      error = if (!is.null(fetch_res$error)) fetch_res$error else "Refresh returned no new data"
    ))
  }
  
  # Both network and cache unavailable
  stop(paste("Data unavailable: failed to fetch from Frankfurter API and no local cache exists.", 
             ifelse(!is.null(fetch_res$error), paste("Error:", fetch_res$error), "")))
}

# Get rates: loads from cache if fresh, otherwise syncs
get_rates_store <- function(base = CONFIG$default_base, 
                            quote = CONFIG$default_quote, 
                            force_refresh = FALSE) {
  cache_path <- get_cache_path(base, quote)
  if (force_refresh || !file.exists(cache_path)) {
    return(sync_rates_cache(base, quote))
  }
  
  cached_df <- load_cache(cache_path)
  if (is.null(cached_df) || nrow(cached_df) == 0) {
    return(sync_rates_cache(base, quote))
  }
  
  now_utc <- format(as.POSIXlt(Sys.time(), tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")
  list(
    data = cached_df,
    status = "cache",
    stale = FALSE,
    last_fetched = if ("fetched_at" %in% names(cached_df)) max(cached_df$fetched_at) else now_utc,
    last_observation_date = max(cached_df$date),
    observation_count = nrow(cached_df),
    error = NULL
  )
}
