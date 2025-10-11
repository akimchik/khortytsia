variable "email_to" {
  description = "The email address for the notification channel."
  type        = string
}

variable "metric_name" {
  description = "The name for the logging metric."
  type        = string
}

variable "metric_filter" {
  description = "The filter for the logging metric."
  type        = string
}

variable "alert_policy_display_name" {
  description = "The display name for the alert policy."
  type        = string
}
