variable "source_bucket_name" {
  description = "The name of the bucket for source code archives."
  type        = string
}

variable "keywords_bucket_name" {
  description = "The name of the bucket where the keywords.json file is stored."
  type        = string
}

variable "location" {
  description = "The location/region for the buckets."
  type        = string
}

variable "keywords_source_path" {
  description = "The path to the keywords.json file."
  type        = string
}
