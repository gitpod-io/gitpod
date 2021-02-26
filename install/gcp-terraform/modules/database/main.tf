/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  google_services = [
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
  ]
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
resource "google_project_service" "database" {
  count   = length(local.google_services)
  project = data.google_project.gitpod_database.project_id
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}


data "google_project" "gitpod_database" {}

#
# Network Configuration
#

resource "google_compute_global_address" "gitpod" {
  name          = var.name
  address_type  = "INTERNAL"
  purpose       = "VPC_PEERING"
  prefix_length = 16
  network       = var.network.id
  project       = data.google_project.gitpod_database.project_id
}

resource "google_service_networking_connection" "gitpod" {
  network                 = var.network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.gitpod.name]
}



#
# Google Service Account
#

resource "google_service_account" "gitpod_database" {
  account_id   = "${var.name}-${random_id.database.hex}"
  display_name = "${var.name}-${random_id.database.hex}"
  description  = "Gitpod Database Account for database ${var.name}-${random_id.database.hex}"
  project      = data.google_project.gitpod_database.project_id
}

resource "google_project_iam_binding" "gitpod_database" {
  project = data.google_project.gitpod_database.project_id
  role    = "roles/cloudsql.client"
  members = [
    "serviceAccount:${google_service_account.gitpod_database.email}"
  ]
}

resource "google_service_account_key" "gitpod_database" {
  service_account_id = google_service_account.gitpod_database.name
}

resource "random_id" "database" {
  byte_length = 4
}

resource "google_sql_database_instance" "gitpod" {
  name             = "${var.name}-${random_id.database.hex}"
  region           = var.region
  database_version = "MYSQL_5_7"
  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network.id
    }
  }
  depends_on = [
    google_service_networking_connection.gitpod
  ]
}

resource "google_sql_database" "gitpod" {
  name      = "gitpod"
  instance  = google_sql_database_instance.gitpod.name
  charset   = "utf8mb4"
  collation = "utf8mb4_bin"
}

resource "google_sql_database" "gitpod_sessions" {
  name      = "gitpod-sessions"
  instance  = google_sql_database_instance.gitpod.name
  charset   = "utf8mb4"
  collation = "utf8mb4_bin"
}

resource "random_password" "gitpod_db_user" {
  length           = 16
  special          = true
  override_special = "_%@"
}

resource "google_sql_user" "gitpod" {
  name     = "gitpod"
  instance = google_sql_database_instance.gitpod.name
  host     = "10.%"
  password = random_password.gitpod_db_user.result
  project  = data.google_project.gitpod_database.project_id
}



#
# Network Peering
#

resource "google_compute_network_peering_routes_config" "servicenetwork" {
  peering = "servicenetworking-googleapis-com"
  network = var.network.name

  import_custom_routes = true
  export_custom_routes = true

  depends_on = [
    google_sql_database_instance.gitpod
  ]
}

resource "google_compute_network_peering_routes_config" "cloudsql" {
  peering = "cloudsql-mysql-googleapis-com"
  network = var.network.name

  import_custom_routes = true
  export_custom_routes = true

  depends_on = [
    google_sql_database_instance.gitpod
  ]
}


resource "kubernetes_secret" "database" {
  metadata {
    name      = "gcloud-sql-token"
    namespace = var.gitpod.namespace
  }

  data = {
    "credentials.json" = base64decode(google_service_account_key.gitpod_database.private_key)
  }
}


resource "kubernetes_secret" "gitpod_database" {
  metadata {
    name      = "gitpod-database"
    namespace = var.gitpod.namespace
  }

  data = {
    host     = google_sql_database_instance.gitpod.first_ip_address
    user     = google_sql_user.gitpod.name
    password = google_sql_user.gitpod.password
  }
}

resource "kubernetes_job" "mysql_initializer" {
  metadata {
    name      = "gitpod-db-initialization"
    namespace = var.gitpod.namespace
  }
  spec {
    template {
      metadata {}
      spec {
        container {
          name    = "db-initialization"
          image   = "gcr.io/gitpod-io/db-migrations:v0.4.0-dev-selfhosted-gitpod-db-init.15"
          command = ["/init.sh", "&&", "echo", "finished"]
          env {
            name = "MYSQL_HOST"
            value_from {
              secret_key_ref {
                name = "gitpod-database"
                key  = "host"
              }
            }
          }
          env {
            name  = "MYSQL_USER"
            value = "gitpod"
          }
          env {
            name  = "MYSQL_PORT"
            value = "3306"
          }
          env {
            name = "MYSQL_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = "gitpod-database"
                key  = "password"
              }
            }
          }
        }
        restart_policy = "Never"
      }
    }
    backoff_limit = 4
  }
}

data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    host        = google_sql_database_instance.gitpod.first_ip_address
    password    = google_sql_user.gitpod.password
    instance    = google_sql_database_instance.gitpod.connection_name
    credentials = kubernetes_secret.database.metadata[0].name
  }
}
