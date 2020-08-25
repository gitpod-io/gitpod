/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Provider
#


#
# Google
#

provider "google" {
  project = var.project
  region  = var.region
}



#
# Kubernetes
#

provider "kubernetes" {
  load_config_file = "false"

  host                   = module.kubernetes.cluster.endpoint
  username               = module.kubernetes.cluster.master_auth[0].username
  password               = module.kubernetes.cluster.master_auth[0].password
  client_certificate     = base64decode(module.kubernetes.cluster.master_auth[0].client_certificate)
  client_key             = base64decode(module.kubernetes.cluster.master_auth[0].client_key)
  cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
}



#
# Helm
#

provider "helm" {
  kubernetes {
    load_config_file = "false"

    host                   = module.kubernetes.cluster.endpoint
    username               = module.kubernetes.cluster.master_auth[0].username
    password               = module.kubernetes.cluster.master_auth[0].password
    client_certificate     = base64decode(module.kubernetes.cluster.master_auth[0].client_certificate)
    client_key             = base64decode(module.kubernetes.cluster.master_auth[0].client_key)
    cluster_ca_certificate = base64decode(module.kubernetes.cluster.master_auth[0].cluster_ca_certificate)
  }
}
