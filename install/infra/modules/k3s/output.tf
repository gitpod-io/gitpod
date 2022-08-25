output "database" {
  sensitive = true
  value = try({
    instance            = "${var.gcp_project}:${var.gcp_region}:${google_sql_database_instance.gitpod.name}"
    username            = "${google_sql_user.users.name}"
    password            = random_password.password.result
    service_account_key = "Upload the JSON file corresponding the service account credentials"
  }, "No database created")
}
