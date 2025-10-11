variable "project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "dataset_id" {
  description = "The ID of the BigQuery dataset."
  type        = string
}

variable "location" {
  description = "The location for the BigQuery dataset."
  type        = string
}

variable "table_id" {
  description = "The ID of the BigQuery table."
  type        = string
}

variable "final_analysis_topic_name" {
  description = "The name of the final analysis Pub/Sub topic."
  type        = string
}

variable "pubsub_service_account_email" {
  description = "The email of the Pub/Sub service account."
  type        = string
}
