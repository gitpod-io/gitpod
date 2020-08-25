/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Service Accounts
#

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/id
resource "random_id" "gitpod_cluster" {
  byte_length = 2
}


# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account
resource "google_service_account" "gitpod_cluster" {
  account_id   = "gitpod-cluster-${random_id.gitpod_cluster.hex}"
  display_name = "gitpod-cluster-${random_id.gitpod_cluster.hex}"
  description  = "Gitpod Meta Nodes ${var.project}"
  project      = var.project
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_iam
resource "google_project_iam_binding" "gitpod_cluster" {
  count   = length(local.roles)
  project = var.project
  role    = local.roles[count.index]
  members = [
    "serviceAccount:${google_service_account.gitpod_cluster.email}",
  ]
}



#
# Data
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/data-sources/compute_network
data "google_compute_network" "gitpod" {
  name = var.network

  depends_on = [
    var.requirements
  ]

}



#
# GKE Cluster
#

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
resource "random_password" "kubernetes" {
  length  = 32
  special = false
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/container_cluster
resource "google_container_cluster" "gitpod" {
  name     = "${var.name}-${random_id.gitpod_cluster.hex}"
  project  = var.project
  location = var.location

  remove_default_node_pool = true
  initial_node_count       = var.kubernetes.initial_node_count

  master_auth {
    username = var.username
    password = random_password.kubernetes.result

    client_certificate_config {
      issue_client_certificate = true
    }
  }

  network    = var.network
  subnetwork = var.subnets[0]


  min_master_version = "1.15.12-gke.9"

}



#
# GKE Nodepools
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/container_node_pool
resource "google_container_node_pool" "gitpod_cluster" {

  name       = "${google_container_cluster.gitpod.name}-${random_id.gitpod_cluster.hex}-nodepool"
  location   = var.location
  cluster    = google_container_cluster.gitpod.name
  node_count = 1

  node_config {
    preemptible     = var.kubernetes.node_pool.preemptible
    machine_type    = var.kubernetes.node_pool.machine_type
    disk_size_gb    = var.kubernetes.node_pool.disk_size_gb
    disk_type       = var.kubernetes.node_pool.disk_type
    local_ssd_count = var.kubernetes.node_pool.local_ssd_count

    metadata = {
      disable-legacy-endpoints = "true"
    }

    labels = {
      "gitpod.io/workload_meta"      = "true"
      "gitpod.io/workload_workspace" = "true"
    }

    image_type = var.kubernetes.node_pool.image_type

    oauth_scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_write",
    ]

    service_account = google_service_account.gitpod_cluster.email

  }
}



#
# Kubernetes Config File
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "kubeconfig" {
  template = file("${path.module}/templates/kubeconfig.tpl")
  vars = {
    server                     = google_container_cluster.gitpod.endpoint
    certificate_authority_data = google_container_cluster.gitpod.master_auth[0].cluster_ca_certificate
    name                       = google_container_cluster.gitpod.name
    namespace                  = var.gitpod.namespace
    # client_certificate         = google_container_cluster.gitpod.master_auth[0].client_certificate
    # client_key                 = google_container_cluster.gitpod.master_auth[0].client_key
    username = google_container_cluster.gitpod.master_auth[0].username
    password = google_container_cluster.gitpod.master_auth[0].password
  }

  depends_on = [
    google_container_node_pool.gitpod_cluster
  ]

}

# https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file
resource "local_file" "gitpod_cluster_kubeconfig" {
  content  = data.template_file.kubeconfig.rendered
  filename = "${path.root}/secrets/kubeconfig"

  depends_on = [
    google_container_node_pool.gitpod_cluster
  ]

}

# https://registry.terraform.io/providers/mildred/null/latest/docs/resources/null_resource
resource "null_resource" "kubernetes_credentials" {
  provisioner "local-exec" {
    command = "gcloud container clusters get-credentials $CLUSTER --region $REGION --project $PROJECT"

    environment = {
      CLUSTER = var.name
      REGION  = var.location
      PROJECT = var.project
    }
  }

  depends_on = [
    google_container_cluster.gitpod
  ]

}



#
# End
#

resource "null_resource" "done" {
  depends_on = [
    google_container_node_pool.gitpod_cluster
  ]
}
