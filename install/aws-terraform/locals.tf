/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  kubernetes = {
    cluster_name   = "gitpod${var.project == "" ? "" : "-${var.project}"}"
    version        = "1.16"
    min_node_count = 1
    max_node_count = 3
    instance_type  = "m4.large"
  }
  vpc = {
    name = "gitpod${var.project == "" ? "" : "-${var.project}"}"
  }
  config_output_path = pathexpand("~/.kube/config")
  gitpod = {
    namespace   = "default"
    valuesFiles = []
  }
}
