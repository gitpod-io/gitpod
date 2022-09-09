terraform {
  backend "gcs" {
    bucket = "gitpod-tf"
    prefix = "k3s/terraform.state"
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
