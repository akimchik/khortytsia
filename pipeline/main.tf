
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    bucket  = "khortytsia-terraform-state"
    prefix  = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "random_string" "bucket_prefix" {
  length  = 8
  special = false
  upper   = false
}

resource "google_storage_bucket" "terraform_state" {
  name          = "khortytsia-terraform-state"
  location      = var.region
  force_destroy = true
}

resource "google_storage_bucket" "source_bucket" {
  name          = "${var.project_id}-source-${random_string.bucket_prefix.result}"
  location      = var.region
  force_destroy = true
}

resource "google_storage_bucket" "keywords_bucket" {
  name          = "${var.project_id}-keywords-${random_string.bucket_prefix.result}"
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

resource "google_cloudfunctions_function" "trigger_ingestion_cycle" {
  name        = "trigger_ingestion_cycle"
  runtime     = "nodejs16"
  entry_point = "triggerIngestionCycle"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "trigger_ingestion_cycle.zip"
  trigger_http = true
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
  name        = "fetch_source_data"
  runtime     = "nodejs16"
  entry_point = "fetchSourceData"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "fetch_source_data.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.source_to_fetch.name
  }
}

resource "google_cloudfunctions_function" "filter_article_content" {
  name        = "filter_article_content"
  runtime     = "nodejs16"
  entry_point = "filterArticleContent"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "filter_article_content.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.article_to_filter.name
  }
  environment_variables = {
    KEYWORDS_BUCKET = google_storage_bucket.keywords_bucket.name
  }
}

resource "google_cloudfunctions_function" "core_analysis" {
  name        = "core_analysis"
  runtime     = "nodejs16"
  entry_point = "coreAnalysis"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "core_analysis.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.article_to_analyze.name
  }
}

resource "google_cloudfunctions_function" "external_verification" {
  name        = "external_verification"
  runtime     = "nodejs16"
  entry_point = "externalVerification"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "external_verification.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.external_verification.name
  }
}

resource "google_cloudfunctions_function" "internal_qc" {
  name        = "internal_qc"
  runtime     = "nodejs16"
  entry_point = "internalQc"
  source_archive_bucket = google_storage_bucket.source_bucket.name
  source_archive_object = "internal_qc.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.internal_qc.name
  }
}

# IAM for trigger_ingestion_cycle to publish to source-to-fetch
resource "google_project_iam_member" "trigger_ingestion_cycle_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.trigger_ingestion_cycle.service_account_email}"
}

# IAM for fetch_source_data to publish to article-to-filter
resource "google_project_iam_member" "fetch_source_data_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.fetch_source_data.service_account_email}"
}

# IAM for filter_article_content to publish to article-to-analyze
resource "google_project_iam_member" "filter_article_content_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.filter_article_content.service_account_email}"
}

# IAM for core_analysis to publish to external-verification and internal-qc
resource "google_project_iam_member" "core_analysis_pubsub_external" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.core_analysis.service_account_email}"
}

# IAM for core_analysis to use Vertex AI
resource "google_project_iam_member" "core_analysis_vertexai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_cloudfunctions_function.core_analysis.service_account_email}"
}

# IAM for external_verification to publish to decision-engine-queue
resource "google_project_iam_member" "external_verification_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.external_verification.service_account_email}"
}

# IAM for internal_qc to publish to decision-engine-queue
resource "google_project_iam_member" "internal_qc_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_cloudfunctions_function.internal_qc.service_account_email}"
}
