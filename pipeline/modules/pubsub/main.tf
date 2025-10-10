resource "google_pubsub_topic" "topics" {
  for_each = toset(var.topic_names)
  name     = each.key
}
