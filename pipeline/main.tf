
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
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
