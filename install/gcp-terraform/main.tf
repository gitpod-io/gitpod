/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


module "network" {
  source = "./modules/network"

  project = var.project
  region  = var.region
  name    = "vpc-gitpod"
}

module "kubernetes" {
  requirements = {
    network = module.network.done
  }

  source = "./modules/kubernetes"

  name     = "gitpod-cluster"
  project  = var.project
  location = var.region
  network  = module.network.vpc.name
}

module "registry" {
  requirements = {
    kubernetes = module.kubernetes.done
  }

  source = "./modules/registry"

  project  = var.project
  hostname = "eu.gcr.io"
}

module "storage" {
  requirements = {
    kubernetes = module.kubernetes.done
  }

  source = "./modules/storage"

  project = var.project
  region  = var.region
}

data "template_file" "gitpod_values" {
  template = file("${path.root}/templates/values.tpl")
  vars     = {}
}

module "helm" {
  source = "./modules/helm"

  project = var.project
  region  = var.region
  kubernetes = {
    namespace = var.kubernetes.namespace
  }
  hostname       = var.domain
  loadBalancerIP = module.network.static_ip
  path           = "${path.root}/${var.chart_location}"
  values = [
    data.template_file.gitpod_values.rendered,
    module.storage.values,
    module.registry.values,
  ]

  forceHTTPS = var.force_https

  requirements = [
    module.network.done,
    module.kubernetes.done,
    module.storage.done,
    module.registry.done,
  ]
}
