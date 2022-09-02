resource "google_service_account" "object_storage_sa" {
  account_id   = local.obj_sa
  display_name = "Service Account managed by TF for object storage"
}

resource "google_project_iam_member" "obj-sa-iam-admin" {
  project = var.project
  role = "roles/storage.admin"

  member = "serviceAccount:${google_service_account.object_storage_sa.email}"
}

resource "google_project_iam_member" "obj-sa-iam-objadmin" {
  project = var.project
  role = "roles/storage.objectAdmin"

  member = "serviceAccount:${google_service_account.object_storage_sa.email}"
}

resource "google_service_account_key" "obj_sa_key" {
  service_account_id = google_service_account.object_storage_sa.name
}

resource "local_file" "gs-credentials" {
  filename = "gs-credentials.json"
  content  = base64decode(google_service_account_key.obj_sa_key.private_key)
}

data "google_container_registry_repository" "gitpod" {
  count = var.enable_external_registry ? 1 : 0
}
