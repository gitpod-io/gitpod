/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


resource "google_project_service" "gitpod_registry" {
  project = var.project
  service = "containerregistry.googleapis.com"

  disable_on_destroy = false
}

resource "random_id" "gitpod_registry" {
  byte_length = 2
}

resource "google_service_account" "gitpod_registry" {
  account_id   = "gitpod-registry-${random_id.gitpod_registry.hex}"
  display_name = "gitpod-registry-full"
  description  = "Gitpod Registry Admin"
  project      = var.project
}

resource "google_project_iam_custom_role" "gitpod_registry" {
  role_id     = "gitpod.registry"
  title       = "Gitpod Registry"
  description = "Gitpod Registry Role"
  permissions = [
    "storage.buckets.create",
    "storage.buckets.delete",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.list",
    "storage.buckets.setIamPolicy",
    "storage.buckets.update",
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
    "storage.objects.getIamPolicy",
    "storage.objects.list",
    "storage.objects.setIamPolicy",
    "storage.objects.update",
  ]
}

resource "google_project_iam_binding" "gitpod_registry" {
  project = var.project
  role    = google_project_iam_custom_role.gitpod_registry.id
  members = [
    "serviceAccount:${google_service_account.gitpod_registry.email}"
  ]
}

resource "google_service_account_key" "gitpod_registry" {
  service_account_id = google_service_account.gitpod_registry.name
}

data "template_file" "gitpod_registry_auth" {
  template = file("${path.module}/templates/registry-auth.tpl")
  vars = {
    hostname = var.hostname
    auth     = base64encode("_json_key: ${base64decode(google_service_account_key.gitpod_registry.private_key)}")
  }
}

resource "kubernetes_secret" "gitpod_registry_auth" {
  metadata {
    name      = "gitpod-registry-${random_id.gitpod_registry.hex}"
    namespace = var.gitpod.namespace
  }

  data = {
    ".dockerconfigjson" = data.template_file.gitpod_registry_auth.rendered
  }

  type = "kubernetes.io/dockerconfigjson"

  depends_on = [
    var.requirements
  ]
}

data "template_file" "gitpod_values_registry" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    hostname    = var.hostname
    project     = var.project
    secret_name = kubernetes_secret.gitpod_registry_auth.metadata[0].name
  }
}

resource "null_resource" "done" {
  depends_on = [
    kubernetes_secret.gitpod_registry_auth
  ]
}
