/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


locals {
  google_services = [
    "containerregistry.googleapis.com"
  ]
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
resource "google_project_service" "gitpod_registry" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}


#
# Service Account
#

resource "google_service_account" "gitpod_registry" {
  account_id   = "gitpod-registry-${var.name}"
  display_name = "gitpod-registry-${var.name}"
  description  = "Gitpod Registry ${var.name}"
  project      = var.project
}

resource "google_project_iam_member" "gitpod_registry" {
  project = var.project
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.gitpod_registry.email}"
}

resource "google_service_account_key" "gitpod_registry" {
  service_account_id = google_service_account.gitpod_registry.name
}




#
# Registry
#

data "template_file" "registry" {
  template = file("${path.module}/templates/registry-auth.tpl")
  vars = {
    auth = base64encode("_json_key: ${base64decode(google_service_account_key.gitpod_registry.private_key)}")
  }
}

resource "kubernetes_secret" "registry" {
  metadata {
    name      = "gitpod-registry"
    namespace = var.gitpod.namespace
  }

  data = {
    ".dockerconfigjson" = data.template_file.registry.rendered
  }

  type = "kubernetes.io/dockerconfigjson"
}

data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    project    = var.project
    secretName = kubernetes_secret.registry.metadata[0].name
  }
}
