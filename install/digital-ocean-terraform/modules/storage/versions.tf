terraform {
  required_providers {
    digitalocean = {
      source = "terraform-providers/digitalocean"
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
