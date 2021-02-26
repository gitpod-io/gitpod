/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "service_account_key" {
  value = base64decode(google_service_account_key.dns.private_key)
}

output "values" {
  value = data.template_file.values.rendered
}

output "hostname" {
  value = local.hostname
}

output "address" {
  value = google_compute_address.gitpod.address
}

output "shortname" {
  value = var.gitpod.shortname
}
