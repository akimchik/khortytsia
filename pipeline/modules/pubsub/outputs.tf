output "topics" {
  description = "A map of the created Pub/Sub topics."
  value       = google_pubsub_topic.topics
}
