/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  google_services = [
    "compute.googleapis.com",
  ]
  region      = trimsuffix(var.location, local.zone_suffix)
  zone_suffix = regex("-[a-z]$", var.location)
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
resource "google_project_service" "main" {
  count   = length(local.google_services)
  project = var.project
  service = local.google_services[count.index]

  disable_dependent_services = false
  disable_on_destroy         = false
}


resource "google_compute_network" "gitpod" {
  name                    = "gitpod"
  description             = "Gitpod Cluster Network"
  auto_create_subnetworks = false
  project                 = var.project

  depends_on = [
    google_project_service.main,
  ]
}

module "kubernetes" {
  source = "../../modules/kubernetes"

  name     = "gitpod"
  network  = google_compute_network.gitpod.name
  project  = var.project
  location = var.location
}

module "dns" {
  source = "../../modules/dns"

  project   = var.project
  location  = var.location
  zone_name = var.zone_name
  name      = "gitpod-dns"
  subdomain = var.subdomain

  depends_on = [
    module.kubernetes,
  ]

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

  depends_on = [
    module.kubernetes,
    module.dns,
  ]
}

#
# Gitpod
#

module "gitpod" {
  source = "../../modules/gitpod"

  project            = var.project
  namespace          = var.namespace
  values             = file("values.yaml")
  dns_values         = module.dns.values
  certificate_values = module.certmanager.values
  license            = var.license
  gitpod = {
    repository   = var.gitpod_repository
    chart        = var.gitpod_chart
    version      = var.gitpod_version
    image_prefix = "gcr.io/gitpod-io/self-hosted/"
  }

  providers = {
    google     = google
    kubernetes = kubernetes
    helm       = helm
  }

  depends_on = [
    module.kubernetes,
    module.dns,
    module.certmanager,
  ]
}
