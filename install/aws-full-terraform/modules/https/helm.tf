/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# https://www.terraform.io/docs/providers/helm/r/release.html
resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  namespace        = var.cert_manager.namespace
  chart            = var.cert_manager.chart
  version          = "v0.16.0"
  recreate_pods    = true
  create_namespace = true
  wait             = true

  set {
    name  = "installCRDs"
    value = "true"
  }
}
