/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


locals {
  dns_prefixes = ["", "*.", "*.ws."]
  google_services = [
    "dns.googleapis.com",
    "compute.googleapis.com"
  ]
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/data-sources/dns_managed_zone
resource "google_project_service" "dns" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_dns_managed_zone" "gitpod" {
  name    = replace(var.hostname, ".", "-")
  project = var.project

  dns_name    = "${var.hostname}."
  description = "Gitpod DNS zone"
}

resource "google_compute_address" "gitpod" {
  name    = var.name
  project = var.project
  region  = var.region
}

resource "google_dns_record_set" "gitpod" {
  count        = length(local.dns_prefixes)
  name         = "${local.dns_prefixes[count.index]}${google_dns_managed_zone.gitpod.dns_name}"
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.gitpod.name
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
    hostname       = var.hostname
    loadBalancerIP = google_compute_address.gitpod.address
  }
}
