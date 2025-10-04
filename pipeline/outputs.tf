output "trigger_ingestion_cycle_url" {
  description = "The URL of the trigger_ingestion_cycle function."
  value       = google_cloudfunctions_function.trigger_ingestion_cycle.https_trigger_url
}

output "keywords_bucket_name" {
  description = "The name of the bucket where the keywords.json file is stored."
  value       = google_storage_bucket.keywords_bucket.name
}
