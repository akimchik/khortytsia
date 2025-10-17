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

module "storage" {
  source               = "./modules/storage"
  source_bucket_name   = "${var.GCP_PROJECT_ID}-source-code"
  keywords_bucket_name = "${var.GCP_PROJECT_ID}-keywords"
  location             = var.region
  keywords_source_path = "../filter_article_content/keywords.json"
}

module "pubsub" {
  source      = "./modules/pubsub"
  topic_names = [
    "source-to-fetch",
    "article-to-filter",
    "article-to-analyze",
    "external-verification",
    "internal-qc",
    "decision-engine-queue",
    "final-analysis",
    "final-leads",
  ]
}



# BigQuery Dataset and Table to store final results
module "bigquery" {
  source                       = "./modules/bigquery"
  project_id                   = var.GCP_PROJECT_ID
  dataset_id                   = "khortytsia_results"
  location                     = var.region
  table_id                     = "approved_leads"
  final_analysis_topic_name    = module.pubsub.topics["final-analysis"].name
  pubsub_service_account_email = google_project_service_identity.pubsub.email
}

module "function_trigger_ingestion_cycle" {
  source                = "./modules/google-cloud-function"
  function_name         = "trigger_ingestion_cycle"
  entry_point           = "triggerIngestionCycle"
  runtime               = "nodejs20"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "trigger_ingestion_cycle.zip"
  trigger_type          = "http"
  depends_on            = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function_iam_member" "trigger_ingestion_cycle_invoker" {
  project        = module.function_trigger_ingestion_cycle.project
  region         = module.function_trigger_ingestion_cycle.region
  cloud_function = module.function_trigger_ingestion_cycle.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

module "scheduler" {
  source          = "./modules/scheduler"
  job_name        = "trigger-ingestion-cycle-scheduler"
  description     = "Triggers the ingestion cycle every 30 minutes"
  schedule        = var.schedule
  time_zone       = "Etc/UTC"
  http_target_uri = module.function_trigger_ingestion_cycle.https_trigger_url
}

module "function_fetch_source_data" {
  source                 = "./modules/google-cloud-function"
  function_name          = "fetch_source_data"
  entry_point            = "fetchSourceData"
  runtime                = "nodejs20"
  source_archive_bucket  = module.storage.source_bucket_name
  source_archive_object  = "fetch_source_data.zip"
  trigger_type           = "event"
  event_trigger_resource = module.pubsub.topics["source-to-fetch"].name
  depends_on             = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "filter_article_content" {
  name                  = "filter_article_content"
  runtime               = "nodejs20"
  entry_point           = "filterArticleContent"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "filter_article_content.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = module.pubsub.topics["article-to-filter"].name
  }
  environment_variables = {
    KEYWORDS_BUCKET = module.storage.keywords_bucket_name
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "core_analysis" {
  name                  = "core_analysis"
  runtime               = "nodejs20"
  entry_point           = "coreAnalysis"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "core_analysis.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = module.pubsub.topics["article-to-analyze"].name
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "external_verification" {
  name                  = "external_verification"
  runtime               = "nodejs20"
  entry_point           = "externalVerification"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "external_verification.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = module.pubsub.topics["external-verification"].name
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "internal_qc" {
  name                  = "internal_qc"
  runtime               = "nodejs20"
  entry_point           = "internalQc"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "internal_qc.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = module.pubsub.topics["internal-qc"].name
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "decision_engine" {
  name                  = "decision_engine"
  runtime               = "nodejs20"
  entry_point           = "decisionEngine"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "decision_engine.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, module.storage]
}

resource "google_cloudfunctions_function" "get_manual_review" {
  name                  = "get_manual_review"
  runtime               = "nodejs20"
  entry_point           = "getManualReview"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "get_manual_review.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_project_service.firestore, module.storage]
}

resource "google_cloudfunctions_function" "submit_correction" {
  name                  = "submit_correction"
  runtime               = "nodejs20"
  entry_point           = "submitCorrection"
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "submit_correction.zip"
  trigger_http          = true
  depends_on            = [google_project_service.cloudbuild, google_project_service.firestore, module.storage]
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
  member  = "serviceAccount:${module.function_trigger_ingestion_cycle.service_account_email}"
}

# IAM for fetch_source_data to publish to article-to-filter
resource "google_project_iam_member" "fetch_source_data_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.function_fetch_source_data.service_account_email}"
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
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "delivery_alerter.zip"
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = module.pubsub.topics["final-leads"].name
  }
  environment_variables = {
    WEBHOOK_URL = "YOUR_WEBHOOK_URL_HERE"
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
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

module "monitoring" {
  source                    = "./modules/monitoring"
  email_to                  = var.EMAIL_TO
  metric_name               = "manual_review_required_metric"
  metric_filter             = "resource.type=\"cloud_function\" AND jsonPayload.review_required=true"
  alert_policy_display_name = "Alert for Manual Review Items"
}