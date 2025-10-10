resource "google_cloudfunctions_function" "function" {
  name        = var.function_name
  runtime     = var.runtime
  entry_point = var.entry_point

  source_archive_bucket = var.source_archive_bucket
  source_archive_object = var.source_archive_object

  dynamic "event_trigger" {
    for_each = var.trigger_type == "event" ? [1] : []
    content {
      event_type = var.event_trigger_type
      resource   = var.event_trigger_resource
    }
  }

  trigger_http          = var.trigger_type == "http"
  environment_variables = var.environment_variables
}
