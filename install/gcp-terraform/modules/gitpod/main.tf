/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */





#
# Gitpod
#

data "template_file" "node_layout_values" {
  template = file("${path.module}/templates/values.node-layout.tpl")
}

data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    image_prefix = var.gitpod.image_prefix
    version      = var.gitpod.version
    license      = var.license
  }
}

resource "helm_release" "gitpod" {
  name  = "gitpod"
  chart = "${path.root}/${var.gitpod.chart}"

  namespace         = var.namespace
  create_namespace  = false
  cleanup_on_fail   = false
  wait              = false
  dependency_update = true

  values = [
    var.values,
    data.template_file.node_layout_values.rendered,
    data.template_file.values.rendered,
    var.dns_values,
    var.certificate_values,
    var.database_values,
    var.registry_values,
    var.storage_values,
  ]
}
