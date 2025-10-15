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

locals {
  functions = {
    trigger_ingestion_cycle = {
      entry_point = "triggerIngestionCycle"
      trigger_type = "http"
    },
    fetch_source_data = {
      entry_point = "fetchSourceData"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["source-to-fetch"].name
    },
    filter_article_content = {
      entry_point = "filterArticleContent"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["article-to-filter"].name
      environment_variables = {
        KEYWORDS_BUCKET = module.storage.keywords_bucket_name
      }
    },
    core_analysis = {
      entry_point = "coreAnalysis"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["article-to-analyze"].name
    },
    external_verification = {
      entry_point = "externalVerification"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["external-verification"].name
    },
    internal_qc = {
      entry_point = "internalQc"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["internal-qc"].name
    },
    decision_engine = {
      entry_point = "decisionEngine"
      trigger_type = "http"
    },
    get_manual_review = {
      entry_point = "getManualReview"
      trigger_type = "http"
    },
    submit_correction = {
      entry_point = "submitCorrection"
      trigger_type = "http"
    },
    delivery_alerter = {
      entry_point = "deliverAlert"
      trigger_type = "event"
      event_trigger_resource = module.pubsub.topics["final-leads"].name
      environment_variables = {
        WEBHOOK_URL = "YOUR_WEBHOOK_URL_HERE"
      }
    }
  }
}

moved {
  from = google_cloudfunctions_function.trigger_ingestion_cycle
  to   = module.functions["trigger_ingestion_cycle"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.fetch_source_data
  to   = module.functions["fetch_source_data"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.filter_article_content
  to   = module.functions["filter_article_content"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.core_analysis
  to   = module.functions["core_analysis"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.external_verification
  to   = module.functions["external_verification"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.internal_qc
  to   = module.functions["internal_qc"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.decision_engine
  to   = module.functions["decision_engine"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.get_manual_review
  to   = module.functions["get_manual_review"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.submit_correction
  to   = module.functions["submit_correction"].google_cloudfunctions_function.function
}

moved {
  from = google_cloudfunctions_function.delivery_alerter
  to   = module.functions["delivery_alerter"].google_cloudfunctions_function.function
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

moved {
  from = google_storage_bucket.source_bucket
  to   = module.storage.google_storage_bucket.source_bucket
}

moved {
  from = google_storage_bucket.keywords_bucket
  to   = module.storage.google_storage_bucket.keywords_bucket
}

moved {
  from = google_storage_bucket_object.keywords
  to   = module.storage.google_storage_bucket_object.keywords
}

moved {
  from = google_storage_bucket_iam_member.public_reader
  to   = module.storage.google_storage_bucket_iam_member.public_reader
}

module "storage" {
  source                 = "./modules/storage"
  source_bucket_name     = "${var.GCP_PROJECT_ID}-source-code"
  keywords_bucket_name   = "gen-lang-client-0963337330-keywords-ulrdl8sh"
  location               = var.region
  keywords_source_path   = "../filter_article_content/keywords.json"
}

moved {
  from = google_pubsub_topic.source_to_fetch
  to   = module.pubsub.google_pubsub_topic.topics["source-to-fetch"]
}

moved {
  from = google_pubsub_topic.article_to_filter
  to   = module.pubsub.google_pubsub_topic.topics["article-to-filter"]
}

moved {
  from = google_pubsub_topic.article_to_analyze
  to   = module.pubsub.google_pubsub_topic.topics["article-to-analyze"]
}

moved {
  from = google_pubsub_topic.external_verification
  to   = module.pubsub.google_pubsub_topic.topics["external-verification"]
}

moved {
  from = google_pubsub_topic.internal_qc
  to   = module.pubsub.google_pubsub_topic.topics["internal-qc"]
}

moved {
  from = google_pubsub_topic.decision_engine_queue
  to   = module.pubsub.google_pubsub_topic.topics["decision-engine-queue"]
}

moved {
  from = google_pubsub_topic.final_analysis
  to   = module.pubsub.google_pubsub_topic.topics["final-analysis"]
}

moved {
  from = google_pubsub_topic.final_leads
  to   = module.pubsub.google_pubsub_topic.topics["final-leads"]
}

module "pubsub" {
  source = "./modules/pubsub"
  topic_names = [
    "source-to-fetch",
    "article-to-filter",
    "article-to-analyze",
    "external-verification",
    "internal-qc",
    "decision-engine-queue",
    "final-analysis",
    "final-leads"
  ]
}

moved {
  from = google_bigquery_dataset.results_dataset
  to   = module.bigquery.google_bigquery_dataset.results_dataset
}

moved {
  from = google_bigquery_table.approved_leads
  to   = module.bigquery.google_bigquery_table.approved_leads
}

moved {
  from = google_project_iam_member.pubsub_to_bigquery
  to   = module.bigquery.google_project_iam_member.pubsub_to_bigquery
}

moved {
  from = google_pubsub_subscription.final_analysis_to_bigquery
  to   = module.bigquery.google_pubsub_subscription.final_analysis_to_bigquery
}

module "bigquery" {
  source                       = "./modules/bigquery"
  project_id                   = var.GCP_PROJECT_ID
  dataset_id                   = "khortytsia_results"
  location                     = var.region
  table_id                     = "approved_leads"
  final_analysis_topic_name    = module.pubsub.topics["final-analysis"].name
  pubsub_service_account_email = google_project_service_identity.pubsub.email
  depends_on                   = [google_project_service.bigquery]
}

module "functions" {
  for_each = local.functions

  source                  = "./modules/google-cloud-function"
  function_name           = each.key
  entry_point             = each.value.entry_point
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "${each.key}.zip"
  trigger_type            = each.value.trigger_type
  event_trigger_resource  = try(each.value.event_trigger_resource, null)
  environment_variables   = try(each.value.environment_variables, null)
}

moved {
  from = google_cloud_scheduler_job.trigger_ingestion_cycle_scheduler
  to   = module.scheduler.google_cloud_scheduler_job.scheduler
}

module "scheduler" {
  source          = "./modules/scheduler"
  job_name        = "trigger-ingestion-cycle-scheduler"
  description     = "Triggers the ingestion cycle every 30 minutes"
  schedule        = var.schedule
  time_zone       = "Etc/UTC"
  http_target_uri = module.functions["trigger_ingestion_cycle"].https_trigger_url
}

# IAM for trigger_ingestion_cycle to publish to source-to-fetch
resource "google_project_iam_member" "trigger_ingestion_cycle_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["trigger_ingestion_cycle"].service_account_email}"
}

# IAM for fetch_source_data to publish to article-to-filter
resource "google_project_iam_member" "fetch_source_data_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["fetch_source_data"].service_account_email}"
}

# IAM for filter_article_content to publish to article-to-analyze
resource "google_project_iam_member" "filter_article_content_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["filter_article_content"].service_account_email}"
}

# IAM for core_analysis to invoke the workflow
resource "google_project_iam_member" "core_analysis_workflow_invoker" {
  project = var.GCP_PROJECT_ID
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${module.functions["core_analysis"].service_account_email}"
}

# IAM for core_analysis to use Vertex AI
resource "google_project_iam_member" "core_analysis_vertexai" {
  project = var.GCP_PROJECT_ID
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${module.functions["core_analysis"].service_account_email}"
}

# IAM for external_verification to publish to decision-engine-queue
resource "google_project_iam_member" "external_verification_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["external_verification"].service_account_email}"
}

# IAM for internal_qc to publish to decision-engine-queue
resource "google_project_iam_member" "internal_qc_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["internal_qc"].service_account_email}"
}

# IAM for decision_engine to publish to final_analysis
resource "google_project_iam_member" "decision_engine_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["decision_engine"].service_account_email}"
}

# IAM for decision_engine to publish to final-leads
resource "google_project_iam_member" "decision_engine_final_leads_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.functions["decision_engine"].service_account_email}"
}

# IAM for functions to access Firestore
resource "google_project_iam_member" "decision_engine_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${module.functions["decision_engine"].service_account_email}"
}

resource "google_project_iam_member" "get_manual_review_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${module.functions["get_manual_review"].service_account_email}"
}

resource "google_project_iam_member" "submit_correction_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = "serviceAccount:${module.functions["submit_correction"].service_account_email}"
}

resource "google_cloudfunctions_function_iam_member" "get_manual_review_invoker_all_users" {
  project        = module.functions["get_manual_review"].project
  region         = module.functions["get_manual_review"].region
  cloud_function = module.functions["get_manual_review"].name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloudfunctions_function_iam_member" "submit_correction_invoker_all_users" {
  project        = module.functions["submit_correction"].project
  region         = module.functions["submit_correction"].region
  cloud_function = module.functions["submit_correction"].name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloudfunctions_function_iam_member" "trigger_ingestion_cycle_invoker" {
  project        = module.functions["trigger_ingestion_cycle"].project
  region         = module.functions["trigger_ingestion_cycle"].region
  cloud_function = module.functions["trigger_ingestion_cycle"].name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_workflows_workflow" "khortytsia_workflow" {
  name            = "khortytsia-workflow"
  region          = var.region
  source_contents = file("../workflow.yaml")
}

moved {
  from = google_monitoring_notification_channel.email_channel
  to   = module.monitoring.google_monitoring_notification_channel.email_channel
}

moved {
  from = google_logging_metric.manual_review_metric
  to   = module.monitoring.google_logging_metric.metric
}

moved {
  from = google_monitoring_alert_policy.manual_review_alert
  to   = module.monitoring.google_monitoring_alert_policy.manual_review_alert
}

module "monitoring" {
  source                    = "./modules/monitoring"
  email_to                  = var.EMAIL_TO
  metric_name               = "manual_review_required_metric"
  metric_filter             = "resource.type=\"cloud_function\" AND jsonPayload.review_required=true"
  alert_policy_display_name = "Alert for Manual Review Items"
}