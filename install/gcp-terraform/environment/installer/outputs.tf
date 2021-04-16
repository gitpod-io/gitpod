/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


output "public_ip" {
  value = google_compute_address.gitpod.address
}

output "hostname" {
  value = local.hostname
}
