resource "digitalocean_spaces_bucket" "foobar" {
  name   = var.bucket_name
  region = var.region
}


data "template_file" "gitpod_storage" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    access_key = random_string.minio_access_key.result
    secret_key = random_password.minio_secret_key.result
  }
}

resource "random_string" "minio_access_key" {
  length = 8
  special = true
}

resource "random_password" "minio_secret_key" {
  length  = 16
  special = true
}

resource "helm_release" "gitpod_storage" {
  name       = "minio"
  repository = "https://helm.min.io"
  chart      = "minio"
  wait       = false

  set {
    name  = "fullnameOverride"
    value = "minio"
  }

  set {
    name  = "accessKey"
    value = random_string.minio_access_key.result
  }

  set {
    name  = "secretKey"
    value = random_password.minio_secret_key.result
  }
}