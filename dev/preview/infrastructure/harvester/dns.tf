locals {
  # Not all consumers of the DNS name handle the fully qualified DNS name (with a dot at the end) well
  # so for those resources, we have this local variable as a convenience. Example: acme_certificate
  non_fully_qualified_dns_name = trim(data.google_dns_managed_zone.preview-gitpod-dev.dns_name, ".")
}

data "google_dns_managed_zone" "preview-gitpod-dev" {
  provider = google
  name     = "preview-gitpod-dev-com"
}

resource "google_dns_record_set" "root" {
  provider = google

  name = "${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.harvester_ingress_ip]
}

resource "google_dns_record_set" "root-wc" {
  provider = google

  name = "*.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.harvester_ingress_ip]
}


resource "google_dns_record_set" "root-wc-ws-dev" {
  provider = google

  name = "*.ws-dev.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [var.harvester_ingress_ip]
}


resource "google_dns_record_set" "root-wc-ws-dev-ssh" {
  provider = google

  name = "*.ssh.ws-dev.${var.preview_name}.${data.google_dns_managed_zone.preview-gitpod-dev.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.preview-gitpod-dev.name
  rrdatas      = [kubernetes_service.dev-svc.status[0].load_balancer[0].ingress[0].ip]
}
