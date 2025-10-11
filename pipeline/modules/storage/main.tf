resource "google_storage_bucket" "source_bucket" {
  name          = var.source_bucket_name
  location      = var.location
  force_destroy = true
}

resource "google_storage_bucket" "keywords_bucket" {
  name          = var.keywords_bucket_name
  location      = var.location
  force_destroy = true
}

resource "google_storage_bucket_object" "keywords" {
  name   = "keywords.json"
  bucket = google_storage_bucket.keywords_bucket.name
  source = var.keywords_source_path
}

resource "google_storage_bucket_iam_member" "public_reader" {
  bucket = google_storage_bucket.keywords_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
