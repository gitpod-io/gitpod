terraform {

  backend "gcs" {
    bucket = "3f4745df-preview-tf-state"
    prefix = "preview"
  }

  required_version = ">= 1.2"
  required_providers {
    harvester = {
      source  = "harvester/harvester"
      version = "=0.5.3"
    }
    k8s = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.0"
    }
    google = {
      source  = "hashicorp/google"
      version = ">=4.40.0"
    }
    acme = {
      source  = "vancluever/acme"
      version = "~> 2.0"
    }
  }
}

provider "harvester" {
  alias       = "harvester"
  kubeconfig  = var.kubeconfig_path
  kubecontext = "harvester"
}

provider "k8s" {
  alias          = "dev"
  config_path    = var.kubeconfig_path
  config_context = var.dev_kube_context
}

provider "k8s" {
  alias          = "harvester"
  config_path    = var.kubeconfig_path
  config_context = var.harvester_kube_context
}

provider "google" {
  project = "gitpod-core-dev"
  region  = "us-central1"
}

provider "acme" {
  alias      = "letsencrypt"
  server_url = "https://acme-v02.api.letsencrypt.org/directory"
}

provider "acme" {
  alias      = "zerossl"
  server_url = "https://acme.zerossl.com/v2/DV90"
}
