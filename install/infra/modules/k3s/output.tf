output "database" {
  sensitive = true
  value = try({
    instance            = "${var.gcp_project}:${var.gcp_region}:${google_sql_database_instance.gitpod.name}"
    username            = "${google_sql_user.users.name}"
    password            = random_password.password.result
    service_account_key_path = var.credentials
  }, "No database created")
}

output "registry" {
  sensitive = true
  value = try({
    url      = "gcr.io/${var.gcp_project}"
    server   = "gcr.io"
    username = "_json_key"
    password_file_path = var.credentials
  }, "No container registry created")
}

output "storage" {
  sensitive = true
  value = try({
    region      = var.gcp_region
    project     = var.gcp_project
    service_account_key_path = var.credentials
  }, "No GCS bucket created for object storage")
}
