/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

module "registry" {
  source = "./modules/registry"
  project = {
    name = var.project
  }
  gitpod               = local.gitpod
  region               = var.region
  worker_iam_role_name = module.kubernetes.worker_iam_role_name

  depends_on = [module.kubernetes.cluster_id]
}

module "storage" {
  source = "./modules/storage"
  project = {
    name = var.project
  }
  region               = var.region
  worker_iam_role_name = module.kubernetes.worker_iam_role_name
  vpc_id               = module.vpc.vpc_id

  depends_on = [
    module.kubernetes.cluster_id
  ]
}

module "gitpod" {
  source       = "./modules/gitpod"
  gitpod       = local.gitpod
  domain_name  = var.domain
  cluster_name = module.kubernetes.cluster_id

  providers = {
    helm       = helm
    kubernetes = kubernetes
  }

  auth_providers = []

  helm = {
    chart = "${path.root}/${var.chart_location}"
  }

  values = [
    module.registry.values,
    module.storage.values,
    <<-EOT
    version: ${var.image_version}
    imagePrefix: ${var.image_prefix}

    # simply setting "{}" does not work as it does not override: https://github.com/helm/helm/issues/5407
    certificatesSecret:
      secretName: ""
    ingressMode: pathAndHost
    forceHTTPS: ${var.force_https}

    installation:
      region: ${var.region}
    
    components:
      # Necessary to make minio send the right header to S3 (region headers must match)
      wsSync:
        remoteStorage:
          minio:
            region: ${var.region}
      
      # make pathAndHost work
      wsProxy:
        disabled: false

    # for debugging
    # imagePrefix: eu.gcr.io/gitpod-core-dev/build/
    # version: gpl-streamline-aws.7
    EOT
  ]

  depends_on = [
    module.kubernetes.cluster_id
  ]
}
