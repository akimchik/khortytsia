output "scheduler_job_name" {
  description = "The name of the Cloud Scheduler job."
  value       = google_cloud_scheduler_job.scheduler.name
}
