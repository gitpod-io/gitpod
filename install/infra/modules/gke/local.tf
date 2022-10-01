locals {
  gke_sa = "gke-sa-${var.cluster_name}"
  gke_iam_roles = toset([
    "roles/storage.admin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/container.admin"
  ])

  gke_user_sa = "user-${var.cluster_name}"

  obj_sa = "obj-sa-${var.cluster_name}"
  obj_iam_roles = var.enable_external_registry ? toset([
    "roles/storage.admin",
    "roles/storage.objectAdmin",
  ]) : []

  db_sa = "db-sa-${var.cluster_name}"

  dns_sa = "dns-sa-${var.cluster_name}"
}
