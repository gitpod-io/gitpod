/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


output "vpc" {
  value = google_compute_network.gitpod
}

output "static_ip" {
  value = google_compute_address.gitpod.address
}

output "done" {
  value = null_resource.done.id
}
