data "google_dns_managed_zone" "preview-gitpod-dev" {
  provider = google
  name     = "preview-gitpod-dev-com"
  project  = var.gcp_project_dns
}

locals {
  # Not all consumers of the DNS name handle the fully qualified DNS name (with a dot at the end) well
  # so for those resources, we have this local variable as a convenience. Example: acme_certificate
  non_fully_qualified_dns_name = trim(data.google_dns_managed_zone.preview-gitpod-dev.dns_name, ".")
}

resource "google_dns_record_set" "root" {
  provider = google
  project  = var.gcp_project_dns

  name = "${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.preview_ip]
}

resource "google_dns_record_set" "root-wc" {
  provider = google
  project  = var.gcp_project_dns

  name = "*.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.preview_ip]
}

resource "google_dns_record_set" "root-wc-ws-dev" {
  provider = google
  project  = var.gcp_project_dns

  name = "*.ws-dev.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.preview_ip]
}

resource "google_dns_record_set" "root-wc-ws-dev-ssh" {
  provider = google
  project  = var.gcp_project_dns

  name = "*.ssh.ws-dev.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.workspace_ip]
}

resource "google_dns_record_set" "root-wc-local-ssh-a" {
  provider = google
  project  = var.gcp_project_dns

  name = "*.lssh.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 86400 # 1day

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = ["127.0.0.1"]
}

resource "google_dns_record_set" "root-wc-local-ssh-aaaa" {
  provider = google
  project  = var.gcp_project_dns

  name = "*.lssh.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "AAAA"
  ttl  = 86400 # 1day

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = ["::1"]
}
