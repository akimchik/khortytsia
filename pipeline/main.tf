terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    bucket = "khortytsia-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.GCP_PROJECT_ID
  region  = var.region
}

provider "google-beta" {
  project = var.GCP_PROJECT_ID
  region  = var.region
}

resource "google_project_service" "cloudbuild" {
  project = var.GCP_PROJECT_ID
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "bigquery" {
  provider                   = google-beta
  project                    = var.GCP_PROJECT_ID
  service                    = "bigquery.googleapis.com"
  disable_dependent_services = true
}

resource "google_project_service" "firestore" {
  project = var.GCP_PROJECT_ID
  service = "firestore.googleapis.com"
}

resource "google_project_service" "gmail" {
  project = var.GCP_PROJECT_ID
  service = "gmail.googleapis.com"
}

# Get the Pub/Sub service account email
resource "google_project_service_identity" "pubsub" {
  provider = google-beta
  project  = var.GCP_PROJECT_ID
  service  = "pubsub.googleapis.com"
}

resource "random_string" "bucket_prefix" {
  length  = 8
  special = false
  upper   = false
}

resource "google_storage_bucket" "source_bucket" {
  name          = "${var.GCP_PROJECT_ID}-source-code"
  location      = var.region
  force_destroy = true
}

resource "google_storage_bucket" "keywords_bucket" {
  name          = "${var.GCP_PROJECT_ID}-keywords-${random_string.bucket_prefix.result}"
  location      = var.region
  force_destroy = true
}

resource "google_storage_bucket_object" "keywords" {
  name   = "keywords.json"
  bucket = google_storage_bucket.keywords_bucket.name
  source = "../filter_article_content/keywords.json"
}

resource "google_storage_bucket_iam_member" "public_reader" {
  bucket = google_storage_bucket.keywords_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_pubsub_topic" "source_to_fetch" {
  name = "source-to-fetch"
}

resource "google_pubsub_topic" "article_to_filter" {
  name = "article-to-filter"
}

resource "google_pubsub_topic" "article_to_analyze" {
  name = "article-to-analyze"
}

resource "google_pubsub_topic" "external_verification" {
  name = "external-verification"
}

resource "google_pubsub_topic" "internal_qc" {
  name = "internal-qc"
}

resource "google_pubsub_topic" "decision_engine_queue" {
  name = "decision-engine-queue"
}

resource "google_pubsub_topic" "final_analysis" {
  name = "final-analysis"
}

resource "google_pubsub_topic" "final_leads" {
  name = "final-leads"
}



# BigQuery Dataset and Table to store final results
resource "google_bigquery_dataset" "results_dataset" {
  dataset_id                 = "khortytsia_results"
  description                = "Dataset to store results from the Khortytsia pipeline"
  location                   = var.region
  delete_contents_on_destroy = true
  depends_on                 = [google_project_service.bigquery]
}

resource "google_bigquery_table" "approved_leads" {
  dataset_id          = google_bigquery_dataset.results_dataset.dataset_id
  table_id            = "approved_leads"
  deletion_protection = false

  schema = <<EOF
[
  {"name": "data", "type": "STRING"}
]
EOF
}

# Grant the Pub/Sub service account permission to write to the BigQuery table
resource "google_project_iam_member" "pubsub_to_bigquery" {
  project = var.GCP_PROJECT_ID
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_project_service_identity.pubsub.email}"
}

# Pub/Sub subscription that writes directly to the BigQuery table
resource "google_pubsub_subscription" "final_analysis_to_bigquery" {
  name  = "final-analysis-to-bigquery-sub"
  topic = google_pubsub_topic.final_analysis.name

  bigquery_config {
    table               = "${google_bigquery_table.approved_leads.project}:${google_bigquery_table.approved_leads.dataset_id}.${google_bigquery_table.approved_leads.table_id}"
    use_topic_schema    = false
    write_metadata      = false
    drop_unknown_fields = true
  }

  depends_on = [google_project_iam_member.pubsub_to_bigquery]
}

resource "google_cloudfunctions_function" "trigger_ingestion_cycle" {
  name                  = "trigger_ingestion_cycle"
  runtime               = "nodejs20"
  entry_point           = "triggerIngestionCycle"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "trigger_ingestion_cycle.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function_iam_member" "trigger_ingestion_cycle_invoker" {
  project        = google_cloudfunctions_function.trigger_ingestion_cycle.project
  region         = google_cloudfunctions_function.trigger_ingestion_cycle.region
  cloud_function = google_cloudfunctions_function.trigger_ingestion_cycle.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloud_scheduler_job" "trigger_ingestion_cycle_scheduler" {
  name        = "trigger-ingestion-cycle-scheduler"
  description = "Triggers the ingestion cycle every 30 minutes"
  schedule    = var.schedule
  time_zone   = "Etc/UTC"

  http_target {
    http_method = "GET"
    uri         = google_cloudfunctions_function.trigger_ingestion_cycle.https_trigger_url
  }
}

resource "google_cloudfunctions_function" "fetch_source_data" {
  name                  = "fetch_source_data"
  runtime               = "nodejs20"
  entry_point           = "fetchSourceData"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "fetch_source_data.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.source_to_fetch.name
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "filter_article_content" {
  name                  = "filter_article_content"
  runtime               = "nodejs20"
  entry_point           = "filterArticleContent"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "filter_article_content.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.article_to_filter.name
  }
  environment_variables = {
    KEYWORDS_BUCKET = google_storage_bucket.keywords_bucket.name
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "core_analysis" {
  name                  = "core_analysis"
  runtime               = "nodejs20"
  entry_point           = "coreAnalysis"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "core_analysis.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.article_to_analyze.name
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "external_verification" {
  name                  = "external_verification"
  runtime               = "nodejs20"
  entry_point           = "externalVerification"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "external_verification.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.external_verification.name
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "internal_qc" {
  name                  = "internal_qc"
  runtime               = "nodejs20"
  entry_point           = "internalQc"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "internal_qc.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.internal_qc.name
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "decision_engine" {
  name                  = "decision_engine"
  runtime               = "nodejs20"
  entry_point           = "decisionEngine"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "decision_engine.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "get_manual_review" {
  name                  = "get_manual_review"
  runtime               = "nodejs20"
  entry_point           = "getManualReview"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "get_manual_review.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_project_service.firestore, google_storage_bucket.source_bucket]
}

resource "google_cloudfunctions_function" "submit_correction" {
  name                  = "submit_correction"
  runtime               = "nodejs20"
  entry_point           = "submitCorrection"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "submit_correction.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_project_service.firestore, google_storage_bucket.source_bucket]
}



resource "google_workflows_workflow" "khortytsia_workflow" {
  name            = "khortytsia-workflow"
  region          = var.region
  source_contents = file("../workflow.yaml")
}

# IAM for trigger_ingestion_cycle to publish to source-to-fetch
resource "google_project_iam_member" "trigger_ingestion_cycle_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.trigger_ingestion_cycle.service_account_email}"
}

# IAM for fetch_source_data to publish to article-to-filter
resource "google_project_iam_member" "fetch_source_data_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.fetch_source_data.service_account_email}"
}

# IAM for filter_article_content to publish to article-to-analyze
resource "google_project_iam_member" "filter_article_content_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.filter_article_content.service_account_email}"
}

# IAM for core_analysis to invoke the workflow
resource "google_project_iam_member" "core_analysis_workflow_invoker" {
  project = var.GCP_PROJECT_ID
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_cloudfunctions_function.core_analysis.service_account_email}"
}

# IAM for core_analysis to use Vertex AI
resource "google_project_iam_member" "core_analysis_vertexai" {
  project = var.GCP_PROJECT_ID
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_cloudfunctions_function.core_analysis.service_account_email}"
}

# IAM for external_verification to publish to decision-engine-queue
resource "google_project_iam_member" "external_verification_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.external_verification.service_account_email}"
}

# IAM for internal_qc to publish to decision-engine-queue
resource "google_project_iam_member" "internal_qc_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.internal_qc.service_account_email}"
}

# IAM for decision_engine to publish to final_analysis and review_notifications
resource "google_project_iam_member" "decision_engine_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.decision_engine.service_account_email}"
}

resource "google_cloudfunctions_function" "delivery_alerter" {
  name                  = "delivery_alerter"
  runtime               = "nodejs20"
  entry_point           = "deliverAlert"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "delivery_alerter.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.final_leads.name
  }
  environment_variables = {
    WEBHOOK_URL = "YOUR_WEBHOOK_URL_HERE"
  }
  depends_on = [google_project_service.cloudbuild, google_storage_bucket.source_bucket]
}

# IAM for decision_engine to publish to final-leads
resource "google_project_iam_member" "decision_engine_final_leads_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.decision_engine.service_account_email}"
}

# IAM for functions to access Firestore
resource "google_project_iam_member" "decision_engine_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_cloudfunctions_function.decision_engine.service_account_email}"
}

resource "google_project_iam_member" "get_manual_review_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_cloudfunctions_function.get_manual_review.service_account_email}"
}

resource "google_project_iam_member" "submit_correction_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_cloudfunctions_function.submit_correction.service_account_email}"
}



resource "google_cloudfunctions_function_iam_member" "get_manual_review_invoker_all_users" {
  project        = google_cloudfunctions_function.get_manual_review.project
  region         = google_cloudfunctions_function.get_manual_review.region
  cloud_function = google_cloudfunctions_function.get_manual_review.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloudfunctions_function_iam_member" "submit_correction_invoker_all_users" {
  project        = google_cloudfunctions_function.submit_correction.project
  region         = google_cloudfunctions_function.submit_correction.region
  cloud_function = google_cloudfunctions_function.submit_correction.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

# --- Alerting for Manual Review ---

# 1. Notification Channel to send the alert email
resource "google_monitoring_notification_channel" "email_channel" {
  display_name = "Email Akim Linnik"
  type         = "email"
  labels = {
    email_address = var.EMAIL_TO
  }
}

# 2. A custom log-based metric to count manual review events
resource "google_logging_metric" "manual_review_metric" {
  name   = "manual_review_required_metric"
  filter = "resource.type=\"cloud_function\" AND jsonPayload.review_required=true"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

# 3. The alert policy that triggers on the metric
resource "google_monitoring_alert_policy" "manual_review_alert" {
  display_name = "Alert for Manual Review Items"
  combiner     = "OR"
  notification_channels = [google_monitoring_notification_channel.email_channel.name]

  conditions {
    display_name = "Manual Review Required"
    condition_threshold {
      filter     = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.manual_review_metric.name}\" AND resource.type=\"cloud_function\""
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