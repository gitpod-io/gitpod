/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Google Compute Network
#

output "vpc" {
  value = google_compute_network.gitpod
}

output "subnets" {
  value = google_compute_subnetwork.gitpod
}

output "done" {
  value = null_resource.done.id
}
