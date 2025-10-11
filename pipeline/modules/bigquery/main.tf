resource "google_bigquery_dataset" "results_dataset" {
  dataset_id                 = var.dataset_id
  description                = "Dataset to store results from the Khortytsia pipeline"
  location                   = var.location
  delete_contents_on_destroy = true
}

resource "google_bigquery_table" "approved_leads" {
  dataset_id          = google_bigquery_dataset.results_dataset.dataset_id
  table_id            = var.table_id
  deletion_protection = false

  schema = <<EOF
[
  {"name": "data", "type": "STRING"}
]
EOF
}

resource "google_project_iam_member" "pubsub_to_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${var.pubsub_service_account_email}"
}

resource "google_pubsub_subscription" "final_analysis_to_bigquery" {
  name  = "final-analysis-to-bigquery-sub"
  topic = var.final_analysis_topic_name

  bigquery_config {
    table               = "${google_bigquery_table.approved_leads.project}:${google_bigquery_table.approved_leads.dataset_id}.${google_bigquery_table.approved_leads.table_id}"
    use_topic_schema    = false
    write_metadata      = false
    drop_unknown_fields = true
  }

  depends_on = [google_project_iam_member.pubsub_to_bigquery]
}
