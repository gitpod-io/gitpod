/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

provider "google" {
  project = var.project
  region  = local.region
}

data "google_client_config" "provider" {}

provider "kubernetes" {
  config_path            = ".kubeconfig"
  host                   = module.kubernetes.cluster.endpoint
  token                  = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = module.kubernetes.cluster.endpoint
    token                  = data.google_client_config.provider.access_token
    cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
  }
}

provider "kubectl" {
  host                   = module.kubernetes.cluster.endpoint
  token                  = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
}
