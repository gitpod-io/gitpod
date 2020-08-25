/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "cluster" {
  value = google_container_cluster.gitpod
}

output "kubeconfig" {
  value = data.template_file.kubeconfig.rendered
}

output "done" {
  value = null_resource.done.id
}