/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */




data "template_file" "gitpod_values_node_affinity" {
  template = file("${path.module}/templates/node-affinity.tpl")
}

data "template_file" "gitpod_values_node_layout" {
  template = file("${path.module}/templates/node-layout.tpl")
}


resource "helm_release" "gitpod" {
  name  = "gitpod-self-hosted"
  chart = "${var.path}"

  namespace        = var.kubernetes.namespace
  create_namespace = true

  timeout = "60"

  wait = false

  values = var.values


  set {
    name  = "hostname"
    value = trimsuffix(var.hostname, ".")
  }

  set {
    name  = "components.proxy.loadBalancerIP"
    value = var.loadBalancerIP
  }

  set {
    name  = "installPodSecurityPolicies"
    value = "true"
  }

  depends_on = [
    var.requirements
  ]

}



#
# End
#

resource "null_resource" "done" {
  depends_on = [
    helm_release.gitpod
  ]
}
