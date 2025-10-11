resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = true
}

resource "google_project_service" "gmail" {
  service            = "gmail.googleapis.com"
  disable_on_destroy = true
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = true
}

resource "google_project_service" "bigquery" {
  service                    = "bigquery.googleapis.com"
  disable_dependent_services = true
  disable_on_destroy         = true
}

resource "google_project_service_identity" "pubsub" {
  provider = google-beta
  service  = "pubsub.googleapis.com"
}

resource "random_string" "bucket_prefix" {
  length  = 8
  special = false
  upper   = false
}

module "storage" {
  source               = "./modules/storage"
  source_bucket_name   = "${var.GCP_PROJECT_ID}-source-code"
  keywords_bucket_name = "${var.GCP_PROJECT_ID}-keywords-${random_string.bucket_prefix.result}"
  location             = "US-CENTRAL1"
  keywords_source_path = "../filter_article_content/keywords.json"
}

module "pubsub" {
  source      = "./modules/pubsub"
  topic_names = var.topics
}

module "functions" {
  for_each                = var.functions
  source                  = "./modules/google-cloud-function"
  function_name           = each.key
  entry_point             = each.value.entry_point
  runtime                 = each.value.runtime
  source_archive_bucket = module.storage.source_bucket_name
  source_archive_object = "${each.key}.zip"
  trigger_type            = each.value.trigger_type
  event_trigger_resource  = each.value.trigger_value
  environment_variables   = each.value.env_vars
}

module "bigquery" {
  source                       = "./modules/bigquery"
  project_id                   = var.GCP_PROJECT_ID
  dataset_id                   = "khortytsia_results"
  location                     = "us-central1"
  table_id                     = "approved_leads"
  final_analysis_topic_name    = "final-analysis"
  pubsub_service_account_email = google_project_service_identity.pubsub.email
}

module "monitoring" {
  source                    = "./modules/monitoring"
  alert_policy_display_name = "Alert for Manual Review Items"
  metric_name               = "manual_review_required_metric"
  metric_filter             = "resource.type=\"cloud_function\" AND jsonPayload.review_required=true"
  email_to                  = var.EMAIL_TO
}

module "scheduler" {
  source          = "./modules/scheduler"
  job_name        = "trigger-ingestion-cycle-scheduler"
  description     = "Triggers the ingestion cycle every 30 minutes"
  schedule        = "*/30 * * * *"
  time_zone       = "Etc/UTC"
  http_target_uri = module.functions["trigger_ingestion_cycle"].function_url
}

resource "google_workflows_workflow" "khortytsia_workflow" {
  name            = "khortytsia-workflow"
  region          = "us-central1"
  service_account = google_service_account.khortytsia_workflow_sa.id

  source_contents = <<-EOT
    main:
      params: [event]
      steps:
        - init:
            assign:
              - project_id: $***sys.get_env("GCLOUD_PROJECT")***
              - region: "us-central1"
              - external_verification_url: "https://us-central1-$***project_id***.cloudfunctions.net/external_verification"
              - internal_qc_url: "https://us-central1-$***project_id***.cloudfunctions.net/internal_qc"
              - decision_engine_url: "https://us-central1-$***project_id***.cloudfunctions.net/decision_engine"
              - article: $***json.decode(base64.decode(event.data.message.data))***
              - combined_results: ***
              # Pre-declare variables to be used by parallel branches
              - external_verification_result: null
              - internal_qc_result: null
    
        - parallel_verification:
            parallel:
              # Specify which existing variables the branches can write to
              shared: [external_verification_result, internal_qc_result]
              branches:
                - external_verification_branch:
                    steps:
                      - external_verification_step:
                          call: http.post
                          args:
                            url: $***external_verification_url***
                            body: $***article***
                          result: external_verification_result # Assigns result to the shared variable
                - internal_qc_branch:
                    steps:
                      - internal_qc_step:
                          call: http.post
                          args:
                            url: $***internal_qc_url***
                            body: $***article***
                          result: internal_qc_result # Assigns result to the shared variable
    
        - combine_base_results:
            assign:
              - combined_results: $***article***
    
        - combine_verification_results:
            assign:
              - combined_results.verification: $***external_verification_result.body***
              - combined_results.internal_qc: $***internal_qc_result.body***
    
        - trigger_decision_engine:
            call: http.post
            args:
              url: $***decision_engine_url***
              body: $***combined_results***
            result: decision_engine_result
    
        - return_result:
            return: $***decision_engine_result.body***
  EOT
}

resource "google_service_account" "khortytsia_workflow_sa" {
  account_id   = "khortytsia-workflow-sa"
  display_name = "Khortytsia Workflow Service Account"
}

resource "google_project_iam_member" "core_analysis_workflow_invoker" {
  project = var.GCP_PROJECT_ID
  role    = "roles/workflows.invoker"
  member  = module.functions["core_analysis"].service_account_email
}

resource "google_project_iam_member" "core_analysis_vertexai" {
  project = var.GCP_PROJECT_ID
  role    = "roles/aiplatform.user"
  member  = module.functions["core_analysis"].service_account_email
}

resource "google_project_iam_member" "external_verification_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["external_verification"].service_account_email
}

resource "google_project_iam_member" "internal_qc_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["internal_qc"].service_account_email
}

resource "google_project_iam_member" "decision_engine_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["decision_engine"].service_account_email
}

resource "google_project_iam_member" "decision_engine_final_leads_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["decision_engine"].service_account_email
}

resource "google_project_iam_member" "decision_engine_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = module.functions["decision_engine"].service_account_email
}

resource "google_project_iam_member" "get_manual_review_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = module.functions["get_manual_review"].service_account_email
}

resource "google_project_iam_member" "submit_correction_firestore" {
  project = var.GCP_PROJECT_ID
  role    = "roles/datastore.user"
  member  = module.functions["submit_correction"].service_account_email
}

resource "google_project_iam_member" "fetch_source_data_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["fetch_source_data"].service_account_email
}

resource "google_project_iam_member" "filter_article_content_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["filter_article_content"].service_account_email
}

resource "google_project_iam_member" "trigger_ingestion_cycle_pubsub" {
  project = var.GCP_PROJECT_ID
  role    = "roles/pubsub.publisher"
  member  = module.functions["trigger_ingestion_cycle"].service_account_email
}

resource "google_cloudfunctions_function_iam_member" "trigger_ingestion_cycle_invoker" {
  project        = module.functions["trigger_ingestion_cycle"].project
  region         = module.functions["trigger_ingestion_cycle"].region
  cloud_function = module.functions["trigger_ingestion_cycle"].function_name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloudfunctions_function_iam_member" "get_manual_review_invoker_all_users" {
  project        = module.functions["get_manual_review"].project
  region         = module.functions["get_manual_review"].region
  cloud_function = module.functions["get_manual_review"].function_name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloudfunctions_function_iam_member" "submit_correction_invoker_all_users" {
  project        = module.functions["submit_correction"].project
  region         = module.functions["submit_correction"].region
  cloud_function = module.functions["submit_correction"].function_name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}