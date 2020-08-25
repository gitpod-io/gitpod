/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# 1st stage of deployment, no dependencies

#
# Network
#

module "network" {
  source = "./modules/network"

  project = var.project
  region  = var.region
  name    = "vpc-gitpod"
}



#
# DNS
#

module "dns" {
  source = "./modules/dns"

  project  = var.project
  region   = var.region
  dns_name = var.dns_name

}





# 2nd stage of deployment, dependent on networking

#
# Kubernetes
#

module "kubernetes" {
  source = "./modules/kubernetes"

  name     = "gitpod-cluster"
  project  = var.project
  location = var.region
  network  = module.network.vpc.name
  subnets  = module.network.subnets.*.self_link

  requirements = {
    network = module.network.done
  }

}





# 3rd stage of deployment, dependent on kubernetes at least

#
# Registry
#

module "registry" {
  source = "./modules/registry"

  project  = var.project
  location = var.container_registry.location
  # https://cloud.google.com/container-registry/docs/pushing-and-pulling#pushing_an_image_to_a_registry
  hostname = "eu.gcr.io"

  requirements = {
    kubernetes = module.kubernetes.done
  }
}



#
# Storage
#

module "storage" {
  source = "./modules/storage"

  project  = var.project
  region   = var.region
  location = "EU"

  requirements = {
    kubernetes = module.kubernetes.done
  }
}



#
# Database
#

module "database" {
  source = "./modules/mysql_gcp"

  project = var.project
  region  = var.region
  network = {
    id   = module.network.vpc.id
    name = module.network.vpc.name
  }
  subnets = module.network.subnets.*.name
  requirements = {
    kubernetes = module.kubernetes.done
  }
}



#
# HTTPS
#

module "https" {
  source = "./modules/https"

  certificate_email = var.certificate_email
  dns_name          = module.dns.zone.dns_name
  project           = var.project
  gitpod = {
    namespace = var.kubernetes.namespace
  }
  kubeconfig = module.kubernetes.kubeconfig

  requirements = {
    kubernetes = module.kubernetes.done
    dns        = module.dns.done
  }
}


#
# Gitpod
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "gitpod_values" {
  template = file("${path.root}/templates/values.tpl")
  vars = {

  }
}



module "gitpod" {
  source = "./modules/gitpod"

  project = var.project
  region  = var.region
  kubernetes = {
    namespace = var.kubernetes.namespace
  }
  hostname       = module.dns.zone.dns_name
  loadBalancerIP = module.dns.static_ip
  path           = "${path.root}/../../chart"
  values = [
    data.template_file.gitpod_values.rendered,
    module.database.values,
    module.storage.values,
    module.registry.values,
    module.https.values,
  ]

  gitpod = {
    license = var.license
  }

  requirements = [
    module.network.done,
    module.kubernetes.done,
    module.database.done,
    module.storage.done,
    module.registry.done,
    module.dns.done,
    module.https.done,
  ]
}
