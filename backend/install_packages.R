# CurLens - Dependency Installer
# Installs required R packages from CRAN binary repository

options(repos = c(CRAN = "https://cloud.r-project.org"))

required_packages <- c(
  "plumber",
  "httr2",
  "jsonlite",
  "dplyr",
  "readr",
  "lubridate",
  "tibble",
  "forecast"
)

install_if_missing <- function(pkgs) {
  installed <- rownames(installed.packages())
  to_install <- setdiff(pkgs, installed)
  
  if (length(to_install) > 0) {
    message("Installing missing packages: ", paste(to_install, collapse = ", "))
    install.packages(to_install, type = "binary")
  } else {
    message("All required packages are already installed.")
  }
}

install_if_missing(required_packages)

# Verify all required packages can be loaded
failed <- character(0)
for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    failed <- c(failed, pkg)
  }
}

if (length(failed) > 0) {
  stop("Failed to load packages: ", paste(failed, collapse = ", "))
} else {
  message("All packages successfully verified!")
}

