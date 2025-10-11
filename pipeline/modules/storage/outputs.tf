output "source_bucket_name" {
  description = "The name of the source code bucket."
  value       = google_storage_bucket.source_bucket.name
}

output "keywords_bucket_name" {
  description = "The name of the keywords bucket."
  value       = google_storage_bucket.keywords_bucket.name
}
