terraform {
  backend "gcs" {
    bucket  = "gitpod-core-dev-terraform"
  }
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "3.63.0"
    }

    # Added for compatibility with old branches, can be deleted if compatibility is not needed
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "1.10.1"
    }
  }
  required_version = ">= 0.13"
}
