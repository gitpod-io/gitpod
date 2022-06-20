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

provider "google" {
  alias       = "dns"
  credentials = var.dns_sa_creds
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
      image = "ubuntu-2004-focal-v20220419"
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
              --k3s-extra-args=" --disable=traefik --node-label=gitpod.io/workload_meta=true --node-label=gitpod.io/workload_ide=true --node-label=gitpod.io/workload_workspace_services=true --node-label=gitpod.io/workload_workspace_regular=true --node-label=gitpod.io/workload_workspace_headless=true" \
          EOT
  }
}

resource "google_dns_record_set" "gitpod-dns" {
  provider     = google.dns
  count        = (var.domain_name == null) || (var.managed_dns_zone == null ) ? 0 : 1
  name         = "${var.domain_name}."
  managed_zone = var.managed_dns_zone
  project      = var.dns_project == null ? var.gcp_project : var.dns_project
  type         = "A"
  ttl          = 5

  rrdatas = [google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip]
}

resource "google_dns_record_set" "gitpod-dns-1" {
  provider     = google.dns
  count        = (var.domain_name == null) || (var.managed_dns_zone == null ) ? 0 : 1
  name         = "ws.${var.domain_name}."
  managed_zone = var.managed_dns_zone
  project      = var.dns_project == null ? var.gcp_project : var.dns_project
  type         = "A"
  ttl          = 5

  rrdatas = [google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip]
}

resource "google_dns_record_set" "gitpod-dns-2" {
  provider     = google.dns
  count        = (var.domain_name == null) || (var.managed_dns_zone == null ) ? 0 : 1
  name         = "*.${var.domain_name}."
  managed_zone = var.managed_dns_zone
  project      = var.dns_project == null ? var.gcp_project : var.dns_project
  type         = "A"
  ttl          = 5

  rrdatas = [google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip]
}

resource "google_dns_record_set" "gitpod-dns-3" {
  provider     = google.dns
  count        = (var.domain_name == null) || (var.managed_dns_zone == null ) ? 0 : 1
  name         = "*.ws.${var.domain_name}."
  managed_zone = var.managed_dns_zone
  project      = var.dns_project == null ? var.gcp_project : var.dns_project
  type         = "A"
  ttl          = 5

  rrdatas = [google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip]
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
