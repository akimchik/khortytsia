variable "function_name" {
  description = "The name of the Cloud Function."
  type        = string
}

variable "entry_point" {
  description = "The name of the function (within your source code) that will be executed."
  type        = string
}

variable "runtime" {
  description = "The runtime in which to run the function."
  type        = string
  default     = "nodejs20"
}

variable "source_archive_bucket" {
  description = "The GCS bucket containing the source code."
  type        = string
}

variable "source_archive_object" {
  description = "The GCS object containing the source code."
  type        = string
}

variable "trigger_type" {
  description = "The type of trigger for the function. Either 'http' or 'event'."
  type        = string
}

variable "event_trigger_resource" {
  description = "The resource that triggers the function for event-based functions."
  type        = string
  default     = null
}

variable "event_trigger_type" {
  description = "The type of event to trigger on."
  type        = string
  default     = "google.pubsub.topic.publish"
}

variable "environment_variables" {
  description = "A map of environment variables to set for the function."
  type        = map(string)
  default     = null
}
