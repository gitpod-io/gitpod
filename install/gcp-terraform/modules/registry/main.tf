/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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
  project = data.google_project.gitpod_registry.project_id
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}


data "google_project" "gitpod_registry" {}

#
# Service Account
#

resource "random_id" "gitpod_registry" {
  byte_length = 4
}

resource "google_service_account" "gitpod_registry" {
  account_id   = "${var.name}-${random_id.gitpod_registry.hex}"
  display_name = "${var.name}-${random_id.gitpod_registry.hex}"
  description  = "Gitpod Registry ${var.name}-${random_id.gitpod_registry.hex}"
  project      = data.google_project.gitpod_registry.project_id
}

resource "google_project_iam_member" "gitpod_registry" {
  project = data.google_project.gitpod_registry.project_id
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
    project    = data.google_project.gitpod_registry.project_id
    secretName = kubernetes_secret.registry.metadata[0].name
  }
}
