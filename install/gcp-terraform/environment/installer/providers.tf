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
  host                   = module.kubernetes.cluster.endpoint
  token                  = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
  load_config_file = "false"
  # See https://github.com/hashicorp/terraform/issues/26211#issuecomment-770456033
  version = "~> 1.10.0"
}

provider "helm" {
  kubernetes {
    host                   = module.kubernetes.cluster.endpoint
    token                  = data.google_client_config.provider.access_token
    cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
  }
}
