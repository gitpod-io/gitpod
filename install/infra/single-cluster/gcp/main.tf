terraform {
  backend "gcs" {
    bucket = "<gcs-bucket-name>"
    prefix = "gcp/terraform.state"
  }

  required_providers {
    google = {
      source = "hashicorp/google"
    }

    kubernetes = {
      source = "hashicorp/kubernetes"
    }

    helm = {
      source = "hashicorp/helm"
    }
  }
}
