terraform {
  backend "gcs" {
    bucket = "5d39183e-preview-tf-state"
    prefix = "preview"
  }

  required_version = ">= 1.8"
  required_providers {
    k8s = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.0"
    }
    google = {
      source  = "hashicorp/google"
      version = ">=5.25.0"
    }
    acme = {
      source  = "vancluever/acme"
      version = "~> 2.0"
    }
  }
}

provider "k8s" {
  alias          = "dev"
  config_path    = pathexpand(var.kubeconfig_path)
  config_context = var.dev_kube_context
}

provider "google" {
  project = "gitpod-dev-preview"
  region  = "europe-west1"
}

provider "acme" {
  alias      = "letsencrypt"
  server_url = "https://acme-v02.api.letsencrypt.org/directory"
}

provider "acme" {
  alias      = "zerossl"
  server_url = "https://acme.zerossl.com/v2/DV90"
}
