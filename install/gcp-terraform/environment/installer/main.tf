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
  source = "./modules/kubernetes"

  name    = "gitpod"
  network = google_compute_network.gitpod.name
  project = var.project
  region  = var.region
}

module "registry" {
  source = "./modules/registry"

  name     = "gitpod"
  project  = var.project
  location = "EU"

  providers = {
    google     = google
    kubernetes = kubernetes
  }
}

module "storage" {
  source = "./modules/storage"

  name     = "gitpod"
  project  = var.project
  region   = var.region
  location = "EU"
}


module "dns" {
  source = "./modules/dns"

  project   = var.project
  region    = var.region
  zone_name = var.zone_name
  name      = "gitpod-static-ip"
  subdomain = ""

  providers = {
    google     = google
    kubernetes = kubernetes
  }
}

module "kubeconfig" {
  source = "./modules/kubeconfig"

  cluster = {
    name = "gitpod"
  }

  depends_on = [
    module.kubernetes
  ]
}

module "certmanager" {
  source = "./modules/certmanager"

  project = var.project
  email   = var.certificate_email
  domain  = local.hostname
  certificate = {
    name = "https-certificates"
    namespace = "default"
  }
  providers = {
    google     = google
    kubernetes = kubernetes
    helm       = helm
    kubectl    = kubectl
  }
}

locals {
  hostname = "${var.domain == "" ? local.mygitpod_domain : var.domain}"
  mygitpod_prefix = replace(module.dns.address,".","-")
  mygitpod_domain = "${local.mygitpod_prefix}.ip.mygitpod.com"
}

data "template_file" "values" {
  template = file("${path.cwd}/templates/values.tpl")
  vars = {
    hostname        = local.hostname
    loadbalancer_ip = module.dns.address
    certbot_enabled = var.certbot_enabled
    certbot_email   = var.certificate_email
    force_https     = var.force_https
  }
}
module "gitpod" {
  source = "./modules/gitpod"

  project = var.project
  region  = var.region
  namespace = var.kubernetes.namespace
  gitpod = {
    chart        = var.chart_location
    image_prefix = var.image_prefix
    version      = var.image_version
  }
  values          = data.template_file.values.rendered
  registry_values = module.registry.values
  storage_values  = module.storage.values
  certificate_values = module.certmanager.values

  providers = {
    google     = google
    kubernetes = kubernetes
    helm       = helm
  }
}
