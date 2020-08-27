# Create a database server


# https://www.terraform.io/docs/providers/aws/r/db_subnet_group.html
resource "aws_db_subnet_group" "gitpod" {
  name       = "db_subnet_group-${var.project.name}"
  subnet_ids = var.subnet_ids

  tags = {
    project        = var.project.name
    provisioned_by = "terraform"
  }
}

resource "random_password" "mysql_password" {
  length           = 16
  special          = true
  override_special = "_%@"
}

# https://www.terraform.io/docs/providers/aws/r/db_instance.html
resource "aws_db_instance" "gitpod" {
  engine         = "mysql"
  engine_version = var.database.engine_version
  instance_class = var.database.instance_class
  name           = var.database.name
  username       = var.database.user_name
  # Fixes an issue when destroying instance
  skip_final_snapshot  = true
  password             = var.database.password == "" ? random_password.mysql_password.result : var.database.password
  port                 = var.database.port
  allocated_storage    = 20
  db_subnet_group_name = aws_db_subnet_group.gitpod.id

  tags = {
    project        = var.project.name
    provisioned_by = "terraform"
  }
}


resource "aws_security_group_rule" "gitpod_database" {
  type                     = "ingress"
  from_port                = var.database.port
  to_port                  = var.database.port
  protocol                 = "tcp"
  security_group_id        = formatlist("%s", aws_db_instance.gitpod.vpc_security_group_ids)[0]
  source_security_group_id = var.security_group_id
}


#
# Kubernetes Resources
#


resource "kubernetes_secret" "gitpod_database" {
  metadata {
    name      = "gitpod-database"
    namespace = var.gitpod.namespace
  }

  data = {
    host     = aws_db_instance.gitpod.address
    port     = aws_db_instance.gitpod.port
    user     = aws_db_instance.gitpod.username
    password = aws_db_instance.gitpod.password
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
            name = "MYSQL_USER"
            value_from {
              secret_key_ref {
                name = "gitpod-database"
                key  = "user"
              }
            }
          }
          env {
            name = "MYSQL_PORT"
            value_from {
              secret_key_ref {
                name = "gitpod-database"
                key  = "port"
              }
            }
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

  depends_on = [
    aws_security_group_rule.gitpod_database
  ]
}

data "template_file" "gitpod_values_database" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    host     = aws_db_instance.gitpod.address
    port     = var.database.port
    username = var.database.user_name
    password = var.database.password
  }
}
