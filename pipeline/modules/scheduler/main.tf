resource "google_cloud_scheduler_job" "scheduler" {
  name        = var.job_name
  description = var.description
  schedule    = var.schedule
  time_zone   = var.time_zone

  http_target {
    http_method = "GET"
    uri         = var.http_target_uri
  }
}
