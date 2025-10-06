output "trigger_ingestion_cycle_url" {
  description = "The URL of the trigger_ingestion_cycle function."
  value       = google_cloudfunctions_function.trigger_ingestion_cycle.https_trigger_url
}

output "decision_engine_url" {
  description = "The URL of the decision_engine function."
  value       = google_cloudfunctions_function.decision_engine.https_trigger_url
}

output "source_bucket_name" {
  description = "The name of the bucket for source code archives."
  value       = google_storage_bucket.source_bucket.name
}

output "keywords_bucket_name" {
  description = "The name of the bucket where the keywords.json file is stored."
  value       = google_storage_bucket.keywords_bucket.name
}

output "source_to_fetch_topic" {
  description = "The name of the source_to_fetch Pub/Sub topic."
  value       = google_pubsub_topic.source_to_fetch.name
}

output "article_to_filter_topic" {
  description = "The name of the article_to_filter Pub/Sub topic."
  value       = google_pubsub_topic.article_to_filter.name
}

output "article_to_analyze_topic" {
  description = "The name of the article_to_analyze Pub/Sub topic."
  value       = google_pubsub_topic.article_to_analyze.name
}

output "external_verification_topic" {
  description = "The name of the external_verification Pub/Sub topic."
  value       = google_pubsub_topic.external_verification.name
}

output "internal_qc_topic" {
  description = "The name of the internal_qc Pub/Sub topic."
  value       = google_pubsub_topic.internal_qc.name
}

output "decision_engine_queue_topic" {
  description = "The name of the decision_engine_queue Pub/Sub topic."
  value       = google_pubsub_topic.decision_engine_queue.name
}

output "final_analysis_topic" {
  description = "The name of the final_analysis Pub/Sub topic."
  value       = google_pubsub_topic.final_analysis.name
}

output "final_leads_topic" {
  description = "The name of the final_leads Pub/Sub topic."
  value       = google_pubsub_topic.final_leads.name
}

output "trigger_ingestion_cycle_scheduler_name" {
  description = "The name of the Cloud Scheduler job."
  value       = google_cloud_scheduler_job.trigger_ingestion_cycle_scheduler.name
}

output "get_manual_review_url" {
  description = "The URL of the get_manual_review function."
  value       = google_cloudfunctions_function.get_manual_review.https_trigger_url
}

output "submit_correction_url" {
  description = "The URL of the submit_correction function."
  value       = google_cloudfunctions_function.submit_correction.https_trigger_url
}
