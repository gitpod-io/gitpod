terraform {

  backend "gcs" {
    bucket = "3f4745df-preview-tf-state"
    prefix = "preview"
  }

  required_version = ">= 1.2"
  required_providers {
    harvester = {
      source  = "harvester/harvester"
      version = ">=0.5.1"
    }
    k8s = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.0"
    }
  }
}

provider "harvester" {
  alias      = "harvester"
  kubeconfig = var.harvester_kube_path
}

provider "k8s" {
  alias       = "dev"
  config_path = var.dev_kube_path
}

provider "k8s" {
  alias       = "harvester"
  config_path = var.harvester_kube_path
}
