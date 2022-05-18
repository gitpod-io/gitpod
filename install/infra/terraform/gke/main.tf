terraform {
  required_version = ">= 1.0.3"
}

terraform {
  backend "gcs" {
    bucket = "gitpod-gke"
    prefix = "tf-state"
  }
}

provider "google" {
  project     = var.project
  credentials = var.credentials
  region      = var.region
  zone        = var.zone
}

resource "google_compute_network" "vpc" {
  name                    = "vpc-${var.name}"
  auto_create_subnetworks = "false"
}

resource "google_compute_subnetwork" "subnet" {
  name          = "subnet-${var.name}"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.255.0.0/16"

  secondary_ip_range {
    range_name    = "cluster-secondary-ip-range"
    ip_cidr_range = "10.0.0.0/12"
  }

  secondary_ip_range {
    range_name    = "services-secondary-ip-range"
    ip_cidr_range = "10.64.0.0/12"
  }
}

resource "google_container_cluster" "gitpod-cluster" {
  name     = "c${var.name}"
  location = var.zone == null ? var.region : var.zone

  cluster_autoscaling {
    enabled = true

    resource_limits {
      resource_type = "cpu"
      minimum       = 2
      maximum       = 16
    }

    resource_limits {
      resource_type = "memory"
      minimum       = 4
      maximum       = 64
    }
  }

  min_master_version = var.kubernetes_version
  # the default nodepool is used as the services nodepool
  remove_default_node_pool = false
  node_config {
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "gitpod.io/workload_meta" = true
      "gitpod.io/workload_ide"  = true
    }

    preemptible  = false
    image_type   = "COS_CONTAINERD"
    disk_type    = "pd-standard"
    disk_size_gb = var.disk_size_gb
    machine_type = var.services_machine_type
    tags         = ["gke-node", "${var.project}-gke"]
    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  initial_node_count       = 1
  release_channel {
    channel = "UNSPECIFIED"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "cluster-secondary-ip-range"
    services_secondary_range_name = "services-secondary-ip-range"
  }

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name
}

resource "google_container_node_pool" "workspaces" {
  name               = "workspaces-${var.name}"
  location           = google_container_cluster.gitpod-cluster.location
  cluster            = google_container_cluster.gitpod-cluster.name
  version            = var.kubernetes_version // kubernetes version
  initial_node_count = 1
  max_pods_per_node  = 110

  node_config {
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "gitpod.io/workload_workspace_services" = true
      "gitpod.io/workload_workspace_regular"  = true
      "gitpod.io/workload_workspace_headless" = true
    }

    preemptible  = false
    image_type   = "UBUNTU_CONTAINERD"
    disk_type    = "pd-standard"
    disk_size_gb = var.disk_size_gb
    machine_type = var.workspaces_machine_type
    tags         = ["gke-node", "${var.project}-gke"]
    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  autoscaling {
    min_node_count = 1
    max_node_count = var.max_count
  }

  management {
    auto_repair  = true
    auto_upgrade = false
  }
}

module "gke_auth" {
  depends_on = [google_container_node_pool.workspaces]

  source = "terraform-google-modules/kubernetes-engine/google//modules/auth"

  project_id   = var.project
  location     = google_container_cluster.gitpod-cluster.location
  cluster_name = "c${var.name}"
}

resource "local_file" "kubeconfig" {
  filename = var.kubeconfig
  content  = module.gke_auth.kubeconfig_raw
}
