resource "google_service_account" "cluster_sa" {
  account_id   = local.gke_sa
  display_name = "Service Account managed by TF for GKE cluster"
}

resource "google_project_iam_member" "gke-sa-iam-storage" {
  for_each = local.gke_iam_roles

  project = var.project
  role    = each.key
  member  = "serviceAccount:${google_service_account.cluster_sa.email}"
}

resource "google_container_cluster" "gitpod-cluster" {
  name     = var.cluster_name
  location = var.zone == null ? var.region : var.zone

  min_master_version = var.cluster_version

  remove_default_node_pool = true

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  initial_node_count = 1
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

    dns_cache_config {
      enabled = true
    }
  }
}

resource "google_container_node_pool" "services" {
  name               = "services-${var.cluster_name}"
  location           = google_container_cluster.gitpod-cluster.location
  cluster            = google_container_cluster.gitpod-cluster.name
  version            = var.cluster_version // kubernetes version
  initial_node_count = 1
  max_pods_per_node  = 110

  node_config {
    service_account = google_service_account.cluster_sa.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "gitpod.io/workload_meta"               = true
      "gitpod.io/workload_ide"                = true
      "gitpod.io/workload_workspace_services" = true
      "gitpod.io/workload_services"           = true
    }

    preemptible  = false
    image_type   = "UBUNTU_CONTAINERD"
    disk_type    = "pd-ssd"
    disk_size_gb = var.services_disk_size_gb
    machine_type = var.services_machine_type
    tags         = ["gke-node", "${var.project}-gke"]
    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  autoscaling {
    min_node_count = 1
    max_node_count = var.max_node_count_services
  }

  management {
    auto_repair  = true
    auto_upgrade = false
  }
}

resource "google_container_node_pool" "regular-workspaces" {
  name               = "regular-ws-${var.cluster_name}"
  location           = google_container_cluster.gitpod-cluster.location
  cluster            = google_container_cluster.gitpod-cluster.name
  version            = var.cluster_version // kubernetes version
  initial_node_count = 1
  max_pods_per_node  = 110

  node_config {
    service_account = google_service_account.cluster_sa.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "gitpod.io/workload_workspace_regular"  = true
    }

    preemptible  = false
    image_type   = "UBUNTU_CONTAINERD"
    disk_type    = "pd-ssd"
    disk_size_gb = var.workspaces_disk_size_gb
    machine_type = var.workspaces_machine_type
    tags         = ["gke-node", "${var.project}-gke"]
    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  autoscaling {
    min_node_count = 1
    max_node_count = var.max_node_count_regular_workspaces
  }

  management {
    auto_repair  = true
    auto_upgrade = false
  }
}

resource "google_container_node_pool" "headless-workspaces" {
  name               = "headless-ws-${var.cluster_name}"
  location           = google_container_cluster.gitpod-cluster.location
  cluster            = google_container_cluster.gitpod-cluster.name
  version            = var.cluster_version // kubernetes version
  initial_node_count = 1
  max_pods_per_node  = 110

  node_config {
    service_account = google_service_account.cluster_sa.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "gitpod.io/workload_workspace_headless" = true
    }

    preemptible  = false
    image_type   = "UBUNTU_CONTAINERD"
    disk_type    = "pd-ssd"
    disk_size_gb = var.workspaces_disk_size_gb
    machine_type = var.workspaces_machine_type
    tags         = ["gke-node", "${var.project}-gke"]
    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  autoscaling {
    min_node_count = 1
    max_node_count = var.max_node_count_headless_workspaces
  }

  management {
    auto_repair  = true
    auto_upgrade = false
  }
}

module "gke_auth" {
  depends_on = [google_container_node_pool.regular-workspaces, google_container_node_pool.headless-workspaces]

  source = "terraform-google-modules/kubernetes-engine/google//modules/auth"

  project_id   = var.project
  location     = google_container_cluster.gitpod-cluster.location
  cluster_name = var.cluster_name
}

resource "local_file" "kubeconfig" {
  filename = var.kubeconfig
  content  = module.gke_auth.kubeconfig_raw
}

resource "google_service_account" "cluster_user_sa" {
  account_id   = local.gke_user_sa
  display_name = "Gitpod Service Account managed by TF for GKE cluster user"
}

resource "google_project_iam_member" "gke-user-sa-iam" {
  project = var.project
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.cluster_user_sa.email}"
}

resource "google_service_account_key" "gke_sa_key" {
  service_account_id = google_service_account.cluster_user_sa.name
}
