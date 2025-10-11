output "https_trigger_url" {
  description = "The https trigger URL for the function."
  value       = google_cloudfunctions_function.function.https_trigger_url
}

output "service_account_email" {
  description = "The service account email for the function."
  value       = google_cloudfunctions_function.function.service_account_email
}

output "project" {
  description = "The project the function is deployed to."
  value       = google_cloudfunctions_function.function.project
}

output "region" {
  description = "The region the function is deployed to."
  value       = google_cloudfunctions_function.function.region
}

output "name" {
  description = "The name of the function."
  value       = google_cloudfunctions_function.function.name
}