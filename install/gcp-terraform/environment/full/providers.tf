/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

provider "google" {
  project = var.project
  region  = var.region
}

data "google_client_config" "provider" {}

provider "kubernetes" {
  load_config_file = "false"

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
  load_config_file = "false"

  host                   = module.kubernetes.cluster.endpoint
  token                  = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
}
