/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


resource "google_project_service" "gitpod_storage" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_on_destroy = false
}

## IAM
resource "random_id" "gitpod_storage" {
  byte_length = 2
}

resource "google_service_account" "gitpod_storage" {
  account_id   = "gitpod-workspace-syncer-${random_id.gitpod_storage.hex}"
  display_name = "gitpod-workspace-syncer"
  description  = "gitpod-workspace-syncer"
  project      = var.project
}

data "google_iam_role" "gitpod_storage_storage_admin_roleinfo" {
  name = "roles/storage.admin"
}

data "google_iam_role" "gitpod_storage_object_admin_roleinfo" {
  name = "roles/storage.objectAdmin"
}

resource "google_project_iam_custom_role" "gitpod_storage" {
  role_id     = "gitpod.storage.${random_id.gitpod_storage.hex}"
  title       = "Gitpod Storage ${random_id.gitpod_storage.hex}"
  description = "Gitpod Storage Role ${random_id.gitpod_storage.hex}"
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

resource "google_project_iam_binding" "gitpod_storage" {
  project = var.project
  role    = google_project_iam_custom_role.gitpod_storage.id
  members = [
    "serviceAccount:${google_service_account.gitpod_storage.email}"
  ]
}

resource "google_service_account_key" "gitpod_storage" {
  service_account_id = google_service_account.gitpod_storage.name
}

## Kubernetes resources
resource "kubernetes_secret" "gitpod_storage" {
  metadata {
    name      = "gitpod-storage-${random_id.gitpod_storage.hex}"
    namespace = var.gitpod.namespace
  }

  data = {
    "key.json" = base64decode(google_service_account_key.gitpod_storage.private_key)
  }

  depends_on = [
    var.requirements,
  ]

}

## Helm values.yaml
data "template_file" "gitpod_storage_values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    project     = var.project
    region      = var.region
    secret_name = "gitpod-storage-${random_id.gitpod_storage.hex}"
  }
}

resource "null_resource" "done" {
  depends_on = [
    kubernetes_secret.gitpod_storage
  ]
}
