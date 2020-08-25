/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Resources
#

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
resource "random_password" "gitpod_database_root" {
  length = 16
  special = false
}

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
resource "random_password" "gitpod_database_user" {
  length = 16
  special = false
}

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/id
resource "random_id" "gitpod_database" {
  byte_length = 2
}

# # https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/secret
# resource "kubernetes_secret" "gitpod_database" {
#   metadata {
#     name      = "${var.database.name}-${random_id.gitpod_database.hex}-mysql"
#     namespace = var.namespace
#   }

#   data = {
#     host          = "${var.database.name}-${random_id.gitpod_database.hex}-mysql"
#     root-password = random_password.gitpod_database_root.result
#     user          = var.database.username
#     password      = random_password.gitpod_database_user.result
#   }

#   # This dependency is added to make sure that the kubernetes cluster is up and running before any kubernetes resource would be deployed
#   depends_on = [
#     var.requirements
#   ]
# }



resource "helm_release" "mysql" {
  name       = "${var.database.name}-${random_id.gitpod_database.hex}"
  namespace  = var.namespace
  chart      = var.database.chart
  repository = var.database.repository
  version    = var.database.version

  set {
    name  = "mysqlRootPassword"
    value = random_password.gitpod_database_root.result
  }

  set {
    name  = "mysqlUser"
    value = var.database.username
  }

  set {
    name  = "mysqlPassword"
    value = random_password.gitpod_database_user.result
  }

  timeout = "1800"

}


resource "kubernetes_job" "mysql_initializer" {
  metadata {
    name      = "gitpod-db-initialization"
    namespace = var.namespace
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
            name  = "MYSQL_HOST"
            value = "${var.database.name}-${random_id.gitpod_database.hex}-mysql"
          }
          env {
            name  = "MYSQL_USER"
            value = "root"
          }
          env {
            name  = "MYSQL_PORT"
            value = "3306"
          }
          env {
            name = "MYSQL_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name  = "${var.database.name}-${random_id.gitpod_database.hex}-mysql"
                key   = "mysql-root-password"
              }
            }
          }
        }
        restart_policy = "Never"
      }
    }
    backoff_limit = 4
  }
  depends_on = [
    helm_release.mysql
  ]
}

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "gitpod_values_database" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    host     = "${var.database.name}-${random_id.gitpod_database.hex}-mysql"
    password = random_password.gitpod_database_root.result
  }
}

#
# End
#

resource "null_resource" "done" {
  depends_on = [
    kubernetes_job.mysql_initializer,
  ]
}
