# 🚀 Khortytsia - A Serverless Data Ingestion & Analysis Pipeline 🧠

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Status: In Progress](https://img.shields.io/badge/status-in%20progress-blue)

Khortytsia is a lightweight, high-performance, serverless data ingestion and analysis pipeline built on Google Cloud. It's designed to fetch data from various sources, filter it for relevance, and then use the power of Gemini 2.5 Pro to extract valuable business insights.

## 🏛️ Architecture

The pipeline is a chain of event-driven Cloud Functions, orchestrated by Pub/Sub messages. This decoupled architecture ensures that each module is independent, scalable, and resilient.

*   **Module 1: Data Ingestion (The Hunter)** - Finds and filters relevant articles.
*   **Module 2: Core Analysis (The Brain)** - Analyzes the articles and extracts insights.
*   **Module 3: External Verification (The Shield)** - Fact-checks the extracted data against external sources.
*   **Module 4: Internal QC (The Editor)** - Performs a final, automated quality control check on the AI's analysis.

![Architecture Diagram](https://storage.googleapis.com/khortytsia-assets/architecture.png)  
*Note: This is a placeholder image. You would need to create and upload your own architecture diagram to a GCS bucket.*

## 📂 File Structure

```
khortytsia/
├── core_analysis/            # Module 2: Core Analysis
│   ├── ...
├── external_verification/    # Module 3: External Verification
│   ├── ...
├── fetch_source_data/        # Module 1: Fetch Source Data
│   ├── ...
├── filter_article_content/   # Module 1: Filter Article Content
│   ├── ...
├── internal_qc/              # Module 4: Internal QC
│   ├── ...
├── pipeline/                 # Infrastructure as Code
│   ├── ...
├── trigger_ingestion_cycle/  # Module 1: Trigger Ingestion Cycle
│   ├── ...
├── .gitignore
├── LICENSE
└── README.md
```

## 🧩 Functions

### Module 1: Data Ingestion

| Function | Trigger | Description |
| :--- | :--- | :--- |
| `trigger_ingestion_cycle` | HTTP | Kicks off the data collection process at regular intervals. |
| `fetch_source_data` | Pub/Sub | Fetches a list of articles from a given source. |
| `filter_article_content` | Pub/Sub | Filters the content of an article for keywords. |

### Module 2: Core Analysis

| Function | Trigger | Description |
| :--- | :--- | :--- |
| `core_analysis` | Pub/Sub | Uses Gemini to analyze the article content and extract insights. |

### Module 3: External Verification

| Function | Trigger | Description |
| :--- | :--- | :--- |
| `external_verification` | Pub/Sub | Fact-checks the extracted data against external sources. |

### Module 4: Internal QC

| Function | Trigger | Description |
| :--- | :--- | :--- |
| `internal_qc` | Pub/Sub | Performs a final, automated quality control check on the AI's analysis. |

## 🚀 Getting Started

### Prerequisites

*   A Google Cloud Platform project
*   [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) installed
*   [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated

### Deployment

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/khortytsia.git
    cd khortytsia
    ```

2.  **Configure Terraform:**

    Create a `terraform.tfvars` file in the `pipeline` directory with the following content:

    ```terraform
    project_id = "your-gcp-project-id"
    ```

3.  **Deploy the infrastructure:**

    From within the `pipeline` directory, run the following commands:

    ```bash
    terraform init
    terraform apply
    ```

## 🔮 What's Next

*   **Module 5: Decision Engine** - Makes a final judgment on the analysis.
*   **CI/CD Pipeline** - Automate the testing and deployment process with GitHub Actions.