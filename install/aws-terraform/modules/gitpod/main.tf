/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# Installs Gitpod!

# https://www.terraform.io/docs/providers/helm/r/release.html
resource "helm_release" "gitpod" {
  name    = "gitpod"
  chart   = var.helm.chart
  wait    = true
  timeout = 600
  # Is buggy: https://github.com/hashicorp/terraform-provider-helm/issues/405
  # see below for workaround
  #dependency_update = true

  values = flatten([
    data.template_file.gitpod_values_main.rendered,
    data.template_file.gitpod_values_auth_provider.rendered,
    [for path in var.gitpod.valuesFiles : file(path)],
    var.values
  ])

}

#
# Kubernetes Resources
#

# To get the external load balancer IP
# https://www.terraform.io/docs/providers/kubernetes/d/service.html
data "kubernetes_service" "proxy" {
  metadata {
    name      = "proxy"
    namespace = helm_release.gitpod.namespace
  }

  depends_on = [
    helm_release.gitpod
  ]
}
