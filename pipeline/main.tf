terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">~ 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">~ 4.0"
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

module "function_filter_article_content" {
  source                 = "./modules/google-cloud-function"
  function_name          = "filter_article_content"
  entry_point            = "filterArticleContent"
  runtime                = "nodejs20"
  source_archive_bucket  = module.storage.source_bucket_name
  source_archive_object  = "filter_article_content.zip"
  trigger_type           = "event"
  event_trigger_resource = module.pubsub.topics["article-to-filter"].name
  environment_variables = {
    KEYWORDS_BUCKET = module.storage.keywords_bucket_name
  }
  depends_on = [google_project_service.cloudbuild, module.storage]
}

module "function_core_analysis" {
  source                 = "./modules/google-cloud-function"
  function_name          = "core_analysis"
  entry_point            = "coreAnalysis"
  runtime                = "nodejs20"
  source_archive_bucket  = module.storage.source_bucket_name
  source_archive_object  = "core_analysis.zip"
  trigger_type           = "event"
  event_trigger_resource = module.pubsub.topics["article-to-analyze"].name
  depends_on             = [google_project_service.cloudbuild, module.storage]
}

module "function_external_verification" {
  source                 = "./modules/google-cloud-function"
  function_name          = "external_verification"
  entry_point            = "externalVerification"
  runtime                = "nodejs20"
  source_archive_bucket  = module.storage.source_bucket_name
  source_archive_object  = "external_verification.zip"
  trigger_type           = "event"
  event_trigger_resource = module.pubsub.topics["external-verification"].name
  depends_on             = [google_project_service.cloudbuild, module.storage]
}

module "function_internal_qc" {
  source                 = "./modules/google-cloud-function"
  function_name          = "internal_qc"
  entry_point            = "internalQc"
  runtime                = "nodejs20"
  source_archive_bucket  = module.storage.source_bucket_name
  source_archive_object  = "internal_qc.zip"
  trigger_type           = "event"
  event_trigger_resource = module.pubsub.topics["internal-qc"].name
  depends_on             = [google_project_service.cloudbuild, module.storage]
}

module "function_decision_engine" {

  source                = "./modules/google-cloud-function"

  function_name         = "decision_engine"

  entry_point           = "decisionEngine"

  runtime               = "nodejs20"

  source_archive_bucket = module.storage.source_bucket_name

  source_archive_object = "decision_engine.zip"

  trigger_type          = "http"

  depends_on            = [google_project_service.cloudbuild, module.storage]

}



module "function_get_manual_review" {

  source                = "./modules/google-cloud-function"

  function_name         = "get_manual_review"

  entry_point           = "getManualReview"

  runtime               = "nodejs20"

  source_archive_bucket = module.storage.source_bucket_name

  source_archive_object = "get_manual_review.zip"

  trigger_type          = "http"

  depends_on            = [google_project_service.cloudbuild, google_project_service.firestore, module.storage]

}



module "function_submit_correction" {

  source                = "./modules/google-cloud-function"

  function_name         = "submit_correction"

  entry_point           = "submitCorrection"

  runtime               = "nodejs20"

  source_archive_bucket = module.storage.source_bucket_name

  source_archive_object = "submit_correction.zip"

  trigger_type          = "http"

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

  member  = "serviceAccount:${module.function_filter_article_content.service_account_email}"

}



# IAM for core_analysis to invoke the workflow

resource "google_project_iam_member" "core_analysis_workflow_invoker" {

  project = var.GCP_PROJECT_ID

  role    = "roles/workflows.invoker"

  member  = "serviceAccount:${module.function_core_analysis.service_account_email}"

}



# IAM for core_analysis to use Vertex AI

resource "google_project_iam_member" "core_analysis_vertexai" {

  project = var.GCP_PROJECT_ID

  role    = "roles/aiplatform.user"

  member  = "serviceAccount:${module.function_core_analysis.service_account_email}"

}



# IAM for external_verification to publish to decision-engine-queue

resource "google_project_iam_member" "external_verification_pubsub" {

  project = var.GCP_PROJECT_ID

  role    = "roles/pubsub.publisher"

  member  = "serviceAccount:${module.function_external_verification.service_account_email}"

}



# IAM for internal_qc to publish to decision-engine-queue

resource "google_project_iam_member" "internal_qc_pubsub" {

  project = var.GCP_PROJECT_ID

  role    = "roles/pubsub.publisher"

  member  = "serviceAccount:${module.function_internal_qc.service_account_email}"

}



# IAM for decision_engine to publish to final_analysis and review_notifications

resource "google_project_iam_member" "decision_engine_pubsub" {

  project = var.GCP_PROJECT_ID

  role    = "roles/pubsub.publisher"

  member  = "serviceAccount:${module.function_decision_engine.service_account_email}"

}



module "function_delivery_alerter" {

  source                 = "./modules/google-cloud-function"

  function_name          = "delivery_alerter"

  entry_point            = "deliverAlert"

  runtime                = "nodejs20"

  source_archive_bucket  = module.storage.source_bucket_name

  source_archive_object  = "delivery_alerter.zip"

  trigger_type           = "event"

  event_trigger_resource = module.pubsub.topics["final-leads"].name

  environment_variables = {

    WEBHOOK_URL = "YOUR_WEBHOOK_URL_HERE"

  }

  depends_on = [google_project_service.cloudbuild, module.storage]

}



# IAM for decision_engine to publish to final-leads

resource "google_project_iam_member" "decision_engine_final_leads_pubsub" {

  project = var.GCP_PROJECT_ID

  role    = "roles/pubsub.publisher"

  member  = "serviceAccount:${module.function_decision_engine.service_account_email}"

}



# IAM for functions to access Firestore

resource "google_project_iam_member" "decision_engine_firestore" {

  project = var.GCP_PROJECT_ID

  role    = "roles/datastore.user"

  member  = "serviceAccount:${module.function_decision_engine.service_account_email}"

}



resource "google_project_iam_member" "get_manual_review_firestore" {

  project = var.GCP_PROJECT_ID

  role    = "roles/datastore.user"

  member  = "serviceAccount:${module.function_get_manual_review.service_account_email}"

}



resource "google_project_iam_member" "submit_correction_firestore" {

  project = var.GCP_PROJECT_ID

  role    = "roles/datastore.user"

  member  = "serviceAccount:${module.function_submit_correction.service_account_email}"

}



resource "google_cloudfunctions_function_iam_member" "get_manual_review_invoker_all_users" {

  project        = module.function_get_manual_review.project

  region         = module.function_get_manual_review.region

  cloud_function = module.function_get_manual_review.name

  role           = "roles/cloudfunctions.invoker"

  member         = "allUsers"

}



resource "google_cloudfunctions_function_iam_member" "submit_correction_invoker_all_users" {

  project        = module.function_submit_correction.project

  region         = module.function_submit_correction.region

  cloud_function = module.function_submit_correction.name

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

moved {
  from = google_cloudfunctions_function.trigger_ingestion_cycle
  to   = module.function_trigger_ingestion_cycle.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.fetch_source_data
  to   = module.function_fetch_source_data.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.filter_article_content
  to   = module.function_filter_article_content.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.core_analysis
  to   = module.function_core_analysis.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.external_verification
  to   = module.function_external_verification.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.internal_qc
  to   = module.function_internal_qc.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.decision_engine
  to   = module.function_decision_engine.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.get_manual_review
  to   = module.function_get_manual_review.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.submit_correction
  to   = module.function_submit_correction.google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.delivery_alerter
  to   = module.function_delivery_alerter.google_cloudfunctions_function.function
}
