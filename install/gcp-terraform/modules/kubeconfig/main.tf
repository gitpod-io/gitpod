/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


data "google_client_config" "provider" {}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/data-sources/container_cluster
data "google_container_cluster" "kubernetes" {
  name     = var.cluster.name
  project  = data.google_client_config.provider.project
  location = data.google_client_config.provider.region
}

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "kubeconfig" {
  template = file("${path.module}/templates/kubeconfig.tpl")
  vars = {
    cluster_ca_certificate = data.google_container_cluster.kubernetes.master_auth[0].cluster_ca_certificate
    host                   = data.google_container_cluster.kubernetes.endpoint
    name                   = data.google_container_cluster.kubernetes.name
    token                  = data.google_client_config.provider.access_token
    namespace              = "default"
  }
}

# https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file
resource "local_file" "kubeconfig" {
  content         = data.template_file.kubeconfig.rendered
  filename        = "${path.root}/secrets/kubeconfig"
  file_permission = 0400
}
