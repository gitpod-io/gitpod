/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


locals {
  google_services = [
    "dns.googleapis.com",
    "compute.googleapis.com"
  ]
  region      = trimsuffix(var.location, local.zone_suffix)
  zone_suffix = regex("-[a-z]$", var.location)
  shortname   = trimsuffix("ws-${var.gitpod.shortname}", "-")
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/data-sources/dns_managed_zone
resource "google_project_service" "dns" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}

data "google_dns_managed_zone" "gitpod" {
  name    = var.zone_name
  project = var.project
}

resource "google_compute_address" "gitpod" {
  name    = var.name
  project = var.project
  region  = local.region
}

resource "google_dns_record_set" "gitpod" {
  count        = length(var.dns_prefixes)
  name         = trimprefix("${trimsuffix(var.dns_prefixes[count.index], ".")}.${var.subdomain}.${data.google_dns_managed_zone.gitpod.dns_name}", ".")
  type         = "A"
  ttl          = 300
  managed_zone = data.google_dns_managed_zone.gitpod.name
  rrdatas      = [google_compute_address.gitpod.address]
  project      = var.project
}

resource "google_dns_record_set" "gitpod_ws" {
  name         = "*.${local.shortname}.${var.subdomain}.${data.google_dns_managed_zone.gitpod.dns_name}"
  type         = "A"
  ttl          = 300
  managed_zone = data.google_dns_managed_zone.gitpod.name
  rrdatas      = [google_compute_address.gitpod.address]
  project      = var.project
}


#
# Google Service Account
#

resource "google_service_account" "dns" {
  account_id   = var.name
  display_name = var.name
  description  = "Gitpod DNS Admin ${var.name}"
  project      = var.project
}

resource "google_project_iam_member" "dns" {
  project = var.project
  role    = "roles/dns.admin"
  member  = "serviceAccount:${google_service_account.dns.email}"
}

resource "google_service_account_key" "dns" {
  service_account_id = google_service_account.dns.name
}

resource "kubernetes_secret" "dns" {
  provider = kubernetes
  metadata {
    name      = "gitpod-dns"
    namespace = var.gitpod.namespace
  }
  data = {
    "key.json" = base64decode(google_service_account_key.dns.private_key)
  }
}

#
# values.yaml
#

data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    hostname       = local.hostname
    loadBalancerIP = google_compute_address.gitpod.address
    shortname      = var.gitpod.shortname
  }
}
