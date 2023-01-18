terraform {
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "3.1.0"
    }
  }
}

terraform {
  backend "gcs" {
    bucket = "gitpod-k3s"
    prefix = "tf-state"
  }
}

provider "google" {
  credentials = var.credentials
  project     = var.gcp_project
  region      = var.gcp_region
  zone        = var.gcp_zone
}

resource "google_service_account" "gcp_instance" {
  account_id   = "sa-${var.name}"
  display_name = "Service Account"
}

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_file" "ssh_private_key_pem" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = ".ssh/google_compute_engine"
  file_permission = "0600"
}

resource "google_compute_firewall" "k3s-firewall" {
  name    = "firewall-${var.name}"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["6443"]
  }

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  target_tags = ["k3s"]

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_instance" "k3s_master_instance" {
  name         = "master-${var.name}"
  machine_type = "n2d-standard-4"
  tags         = ["k3s", "k3s-master", "http-server", "https-server", "allow-ssh"]

  boot_disk {
    initialize_params {
      image = var.image_id
      size  = 100
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"

    access_config {}
  }

  depends_on = [
    google_compute_firewall.k3s-firewall,
    local_file.ssh_private_key_pem,
    google_service_account.gcp_instance,
  ]
  metadata = {
    ssh-keys = "gitpod:${tls_private_key.ssh.public_key_openssh}"
  }

  service_account {
    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    email  = google_service_account.gcp_instance.email
    scopes = ["cloud-platform"]
  }
}

resource "time_sleep" "wait_for_master" {
  depends_on = [google_compute_instance.k3s_master_instance]

  create_duration = "60s"
}

resource "null_resource" "k3sup_install" {
  depends_on = [time_sleep.wait_for_master]

  provisioner "local-exec" {
    command = <<EOT
              k3sup install \
              --ip ${google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip} \
              --ssh-key .ssh/google_compute_engine \
              --context k3s \
              --user gitpod \
              --local-path ${var.kubeconfig} \
              --k3s-version ${var.cluster_version} \
              --k3s-extra-args=" --disable=traefik --node-label=gitpod.io/workload_meta=true --node-label=gitpod.io/workload_ide=true --node-label=gitpod.io/workload_workspace_services=true --node-label=gitpod.io/workload_workspace_regular=true --node-label=gitpod.io/workload_workspace_headless=true" \
              --node-label gitpod.io/workload_services=true \
          EOT
  }
}

resource "random_string" "random" {
  length  = 4
  upper   = false
  special = false
}

resource "google_sql_database_instance" "gitpod" {
  name             = "sql-${var.name}-${random_string.random.result}"
  database_version = "MYSQL_5_7"
  region           = var.gcp_region
  settings {
    tier = "db-n1-standard-2"
  }
  deletion_protection = false
}

resource "google_sql_database" "database" {
  name      = "gitpod"
  instance  = google_sql_database_instance.gitpod.name
  charset   = "utf8"
  collation = "utf8_general_ci"
}

resource "random_password" "password" {

  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_user" "users" {
  name     = "gitpod"
  instance = google_sql_database_instance.gitpod.name
  password = random_password.password.result
}

data "local_file" "kubeconfig" {
  depends_on = [null_resource.k3sup_install]
  filename   = var.kubeconfig
}

output "kubernetes_endpoint" {
  value = google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip
}

output "kubeconfig" {
  value = var.kubeconfig
}
