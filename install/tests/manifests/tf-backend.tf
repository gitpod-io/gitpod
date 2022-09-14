terraform {
  backend "gcs" {
    bucket = "nightly-tests"
    prefix = "tf-state"
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
