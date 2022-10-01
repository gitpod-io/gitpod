terraform {
  required_version = ">= 1.0.3"
}

provider "google" {
  project = var.project
  region  = var.region
  zone    = var.zone
}
