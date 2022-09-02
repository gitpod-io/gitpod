resource "google_service_account" "db_sa" {
  count    = var.enable_external_database ? 1 : 0

  account_id   = local.db_sa
  display_name = "Service Account managed by TF for object storage"
}

resource "google_project_iam_member" "db-sa-iam" {
  count    = var.enable_external_database ? 1 : 0

  project = var.project
  role = "roles/cloudsql.client"

  member = "serviceAccount:${google_service_account.db_sa[count.index].email}"
}

resource "google_service_account_key" "db_sa_key" {
  count    = var.enable_external_database ? 1 : 0

  service_account_id = google_service_account.db_sa[count.index].name
}

resource "random_string" "random" {
  length           = 4
  upper            = false
  special          = false
}

resource "google_sql_database_instance" "gitpod" {
  count            = var.enable_external_database ? 1 : 0
  name             = "sql-${var.cluster_name}-${random_string.random.result}" // we cannot reuse the same name for 1 week
  database_version = "MYSQL_5_7"
  region           = var.region
  settings {
    tier = "db-n1-standard-2"
  }
  deletion_protection = false
}

resource "random_password" "password" {
  count = var.enable_external_database ? 1 : 0

  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_database" "database" {
  count     = var.enable_external_database ? 1 : 0
  name      = "gitpod"
  instance  = google_sql_database_instance.gitpod[count.index].name
  charset   = "utf8"
  collation = "utf8_general_ci"
}

resource "google_sql_user" "users" {
  count    = var.enable_external_database ? 1 : 0
  name     = "gitpod"
  instance = google_sql_database_instance.gitpod[count.index].name
  password = random_password.password[count.index].result
}
