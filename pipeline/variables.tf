variable "GCP_PROJECT_ID" {
  description = "The GCP project ID."
  type        = string
}

variable "EMAIL_TO" {
  description = "The email address for the notification channel."
  type        = string
}

variable "topics" {
  description = "A list of Pub/Sub topics to create."
  type        = list(string)
  default = [
    "article-to-analyze",
    "article-to-filter",
    "decision-engine-queue",
    "external-verification",
    "final-analysis",
    "final-leads",
    "internal-qc",
    "source-to-fetch",
  ]
}

variable "functions" {
  description = "A map of Cloud Functions to create."
  type = map(object({
    entry_point   = string
    runtime       = string
    trigger_type  = string
    trigger_value = string
    env_vars      = map(string)
  }))
  default = {
    "core_analysis" = {
      entry_point   = "coreAnalysis"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "article-to-analyze"
      env_vars      = null
    },
    "decision_engine" = {
      entry_point   = "decisionEngine"
      runtime       = "nodejs20"
      trigger_type  = "http"
      trigger_value = null
      env_vars      = null
    },
    "delivery_alerter" = {
      entry_point   = "deliverAlert"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "final-leads"
      env_vars = {
        "WEBHOOK_URL" = "YOUR_WEBHOOK_URL_HERE"
      }
    },
    "external_verification" = {
      entry_point   = "externalVerification"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "external-verification"
      env_vars      = null
    },
    "fetch_source_data" = {
      entry_point   = "fetchSourceData"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "source-to-fetch"
      env_vars      = null
    },
    "filter_article_content" = {
      entry_point   = "filterArticleContent"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "article-to-filter"
      env_vars      = null
    },
    "get_manual_review" = {
      entry_point   = "getManualReview"
      runtime       = "nodejs20"
      trigger_type  = "http"
      trigger_value = null
      env_vars      = null
    },
    "internal_qc" = {
      entry_point   = "internalQc"
      runtime       = "nodejs20"
      trigger_type  = "event"
      trigger_value = "internal-qc"
      env_vars      = null
    },
    "submit_correction" = {
      entry_point   = "submitCorrection"
      runtime       = "nodejs20"
      trigger_type  = "http"
      trigger_value = null
      env_vars      = null
    },
    "trigger_ingestion_cycle" = {
      entry_point   = "triggerIngestionCycle"
      runtime       = "nodejs20"
      trigger_type  = "http"
      trigger_value = null
      env_vars      = null
    }
  }
}