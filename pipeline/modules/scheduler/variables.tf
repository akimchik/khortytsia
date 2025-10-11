variable "job_name" {
  description = "The name of the Cloud Scheduler job."
  type        = string
}

variable "description" {
  description = "The description of the Cloud Scheduler job."
  type        = string
}

variable "schedule" {
  description = "The cron schedule for the job."
  type        = string
}

variable "time_zone" {
  description = "The time zone for the schedule."
  type        = string
}

variable "http_target_uri" {
  description = "The URI for the HTTP target."
  type        = string
}
