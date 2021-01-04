/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


resource "google_compute_network" "gitpod" {
  name                    = "gitpod"
  description             = "Gitpod Cluster Network"
  auto_create_subnetworks = false
  project                 = var.project
}

module "kubernetes" {
  source = "../../modules/kubernetes"

  name    = "gitpod"
  network = google_compute_network.gitpod.name
  project = var.project
  region  = var.region
}


module "kubeconfig" {
  source = "../../modules/kubeconfig"

  cluster = {
    name = "gitpod"
  }

  depends_on = [
    module.kubernetes
  ]
}

module "dns" {
  source = "../../modules/dns"

  project   = var.project
  region    = var.region
  zone_name = var.zone_name
  name      = "gitpod-dns"
  subdomain = var.subdomain

  providers = {
    google     = google
    kubernetes = kubernetes
  }
}


module "certmanager" {
  source = "../../modules/certmanager"

  project = var.project
  email   = var.certificate_email
  domain  = module.dns.hostname

  providers = {
    google     = google
    kubernetes = kubernetes
    helm       = helm
    kubectl    = kubectl
  }
}

module "registry" {
  source = "../../modules/registry"

  name     = var.subdomain
  project  = var.project
  location = var.container_registry.location

  providers = {
    google     = google
    kubernetes = kubernetes
  }
}


module "storage" {
  source = "../../modules/storage"

  name     = var.subdomain
  project  = var.project
  region   = var.region
  location = "EU"
}

module "database" {
  source = "../../modules/database"

  project = var.project
  name    = var.database.name
  region  = var.region
  network = {
    id   = google_compute_network.gitpod.id
    name = google_compute_network.gitpod.name
  }
}

#
# Gitpod
#

module "gitpod" {
  source = "../../modules/gitpod"

  project            = var.project
  region             = var.region
  namespace          = var.namespace
  values             = file("values.yaml")
  dns_values         = module.dns.values
  certificate_values = module.certmanager.values
  database_values    = module.database.values
  registry_values    = module.registry.values
  storage_values     = module.storage.values
  license            = var.license

  gitpod = {
    chart        = "../../../../chart"
    image_prefix = "gcr.io/gitpod-io/self-hosted/"
    version      = "0.6.0-beta1"
  }

  providers = {
    google     = google
    kubernetes = kubernetes
    helm       = helm
  }
}
