locals {
  gcp = {
    services = [
      "dns.googleapis.com",
    ]
  }
}

data "google_folder" "preview_folder" {
  folder              = "folders/749048792553"
  lookup_organization = true
}

data "google_dns_managed_zone" "gcp-gitpod-dev-com" {
  name    = "gcp-gitpod-dev-com"
  project = "preview-setup"
}

resource "random_id" "gitpod" {
  byte_length = 4
}

resource "google_project" "gitpod" {
  name       = "preview"
  project_id = "preview-${random_id.gitpod.hex}"
  folder_id  = data.google_folder.preview_folder.name
  billing_account = "01C05A-85FB6F-361061"
}

resource "google_project_service" "project" {
  count   = length(local.gcp.services)
  project = google_project.gitpod.project_id
  service = local.gcp.services[count.index]
  disable_on_destroy = false
}

resource "google_dns_managed_zone" "gitpod" {
  name        = "preview1-${data.google_dns_managed_zone.gcp-gitpod-dev-com.name}"
  dns_name    = "preview1.${data.google_dns_managed_zone.gcp-gitpod-dev-com.dns_name}"
  description = "Preview1"
  project     = google_project.gitpod.project_id
  depends_on = [
    google_project_service.project
  ]
}

resource "google_dns_record_set" "gitpod" {
  project = data.google_dns_managed_zone.gcp-gitpod-dev-com.project
  name    = google_dns_managed_zone.gitpod.dns_name
  type    = "NS"
  ttl     = 60
  managed_zone = data.google_dns_managed_zone.gcp-gitpod-dev-com.name
  rrdatas = google_dns_managed_zone.gitpod.name_servers
}