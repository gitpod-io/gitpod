/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


locals {
  roles = [
    "roles/clouddebugger.agent",
    "roles/cloudtrace.agent",
    "roles/errorreporting.writer",
    "roles/logging.viewer",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.admin",
    "roles/storage.objectAdmin",
  ]
  google_services = [
    "iam.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "logging.googleapis.com",
  ]
  region      = trimsuffix(var.location, local.zone_suffix)
  zone_suffix = regex("-[a-z]$", var.location)
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
resource "google_project_service" "kubernetes" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_compute_subnetwork" "gitpod" {
  name                     = var.subnet.name
  ip_cidr_range            = var.subnet.cidr
  region                   = local.region
  network                  = var.network
  private_ip_google_access = true

  depends_on = [
    local.google_services
  ]
}

resource "google_service_account" "gitpod" {
  account_id   = "${var.name}-nodes"
  display_name = "${var.name}-nodes"
  description  = "Gitpod Nodes ${var.name}"
  project      = var.project

  depends_on = [
    local.google_services
  ]
}

resource "google_project_iam_member" "gitpod" {
  count   = length(local.roles)
  project = var.project
  role    = local.roles[count.index]
  member  = "serviceAccount:${google_service_account.gitpod.email}"

  depends_on = [
    local.google_services
  ]
}

resource "google_container_cluster" "gitpod" {
  name     = var.name
  project  = var.project
  location = var.location

  remove_default_node_pool = true
  initial_node_count       = 1

  master_auth {
    client_certificate_config {
      issue_client_certificate = true
    }
  }

  default_max_pods_per_node = 110

  pod_security_policy_config {
    enabled = true
  }

  addons_config {
    network_policy_config {
      disabled = false
    }
  }

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  network    = var.network
  subnetwork = google_compute_subnetwork.gitpod.id

  ip_allocation_policy {}

  min_master_version = "1.16"

  depends_on = [
    local.google_services
  ]
}

resource "google_container_node_pool" "gitpod" {

  name     = "nodepool-0"
  location = var.location
  cluster  = google_container_cluster.gitpod.name

  initial_node_count = 1

  node_config {
    preemptible     = false
    machine_type    = "n1-standard-8"
    disk_size_gb    = 100
    disk_type       = "pd-ssd"
    local_ssd_count = 1

    workload_metadata_config {
      node_metadata = "SECURE"
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }

    labels = {
      "gitpod.io/workload_meta"      = "true"
      "gitpod.io/workload_workspace" = "true"
    }

    image_type = "UBUNTU_CONTAINERD"

    oauth_scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_write",
    ]

    service_account = google_service_account.gitpod.email
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
    ]
  }
}
