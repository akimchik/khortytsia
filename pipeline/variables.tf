variable "project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy the resources in."
  type        = string
  default     = "us-central1"
}

variable "schedule" {
  description = "The schedule for the trigger_ingestion_cycle scheduler."
  type        = string
  default     = "*/30 * * * *"
}

variable "email_from" {
  description = "The 'from' address for email notifications (must be your Gmail address)."
  type        = string
}

variable "email_to" {
  description = "The recipient address for email notifications."
  type        = string
}