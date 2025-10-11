resource "google_monitoring_notification_channel" "email_channel" {
  display_name = "Email Akim Linnik"
  type         = "email"
  labels = {
    email_address = var.email_to
  }
}

resource "google_logging_metric" "metric" {
  name   = var.metric_name
  filter = var.metric_filter
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "manual_review_alert" {
  display_name = var.alert_policy_display_name
  combiner     = "OR"
  notification_channels = [google_monitoring_notification_channel.email_channel.name]

  conditions {
    display_name = "Manual Review Required"
    condition_threshold {
      filter     = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.metric.name}\" AND resource.type=\"cloud_function\""
      duration   = "60s"
      comparison = "COMPARISON_GT"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }
}
