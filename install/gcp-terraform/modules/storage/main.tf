/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


locals {
  google_services = [
    "storage-api.googleapis.com",
    "storage-component.googleapis.com",
  ]
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
resource "google_project_service" "storage" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}



#
# Service Account
#

resource "google_service_account" "gitpod_storage" {
  account_id   = "gitpod-storage"
  display_name = "gitpod-storage"
  description  = "gitpod-workspace-syncer"
  project      = var.project
}

resource "google_project_iam_member" "gitpod_storage" {
  project = var.project
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.gitpod_storage.email}"
}

resource "google_service_account_key" "gitpod_storage" {
  service_account_id = google_service_account.gitpod_storage.name
}

resource "kubernetes_secret" "storage" {
  metadata {
    name      = "gcloud-creds"
    namespace = var.gitpod.namespace
  }

  data = {
    "key.json" = base64decode(google_service_account_key.gitpod_storage.private_key)
  }
}

data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    secretName = kubernetes_secret.storage.metadata[0].name
    region     = var.region
    project    = var.project
  }
}
