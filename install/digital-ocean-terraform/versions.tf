terraform {
  required_providers {
    digitalocean = {
      source  = "terraform-providers/digitalocean"
      version = ">= 1.22.2"
    }
    helm = {
      source = "hashicorp/helm"
    }
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
    random = {
      source = "hashicorp/random"
    }
    template = {
      source = "hashicorp/template"
    }
  }
  required_version = ">= 0.13"
}
