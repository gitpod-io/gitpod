resource "google_service_account" "object_storage_sa" {
  count = var.enable_external_registry ? 1 : 0

  account_id   = local.obj_sa
  display_name = "Service Account managed by TF for object storage"
}

resource "google_project_iam_member" "obj-sa-iam-admin" {
  for_each = local.obj_iam_roles

  project = var.project
  role    = each.key
  member  = "serviceAccount:${google_service_account.object_storage_sa[0].email}"
}

resource "google_service_account_key" "obj_sa_key" {
  count = var.enable_external_registry ? 1 : 0

  service_account_id = google_service_account.object_storage_sa[count.index].name
}

data "google_container_registry_repository" "gitpod" {
  count = var.enable_external_registry ? 1 : 0
}
