output "trigger_ingestion_cycle_url" {
  description = "The URL of the trigger_ingestion_cycle function."
  value       = module.function_trigger_ingestion_cycle.https_trigger_url
}

output "decision_engine_url" {
  description = "The URL of the decision_engine function."
  value       = module.function_decision_engine.https_trigger_url
}



output "source_bucket_name" {
  description = "The name of the source code bucket."
  value       = module.storage.source_bucket_name
}

output "keywords_bucket_name" {
  description = "The name of the keywords bucket."
  value       = module.storage.keywords_bucket_name
}

output "source_to_fetch_topic" {
  description = "The name of the source_to_fetch Pub/Sub topic."
  value       = module.pubsub.topics["source-to-fetch"].name
}

output "article_to_filter_topic" {
  description = "The name of the article_to_filter Pub/Sub topic."
  value       = module.pubsub.topics["article-to-filter"].name
}

output "article_to_analyze_topic" {
  description = "The name of the article_to_analyze Pub/Sub topic."
  value       = module.pubsub.topics["article-to-analyze"].name
}

output "external_verification_topic" {
  description = "The name of the external_verification Pub/Sub topic."
  value       = module.pubsub.topics["external-verification"].name
}

output "internal_qc_topic" {
  description = "The name of the internal_qc Pub/Sub topic."
  value       = module.pubsub.topics["internal-qc"].name
}

output "decision_engine_queue_topic" {
  description = "The name of the decision_engine_queue Pub/Sub topic."
  value       = module.pubsub.topics["decision-engine-queue"].name
}

output "final_analysis_topic" {
  description = "The name of the final_analysis Pub/Sub topic."
  value       = module.pubsub.topics["final-analysis"].name
}

output "final_leads_topic" {
  description = "The name of the final_leads Pub/Sub topic."
  value       = module.pubsub.topics["final-leads"].name
}

output "trigger_ingestion_cycle_scheduler_name" {
  description = "The name of the Cloud Scheduler job."
  value       = module.scheduler.scheduler_job_name
}


