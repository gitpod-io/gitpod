/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_managed_zone
resource "google_dns_managed_zone" "gitpod" {
  name     = replace(trimsuffix(var.dns_name, ".-"), ".", "-")
  dns_name = "${trimsuffix(var.dns_name, ".-")}."
}



#
# Static IP
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_address
resource "google_compute_address" "gitpod" {
  name = "gitpod-static-ip"

  project = var.project
  region  = var.region
}



#
# DNS records
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set
resource "google_dns_record_set" "gitpod" {
  count        = length(local.dns_prefixes)
  name         = "${local.dns_prefixes[count.index]}${google_dns_managed_zone.gitpod.dns_name}"
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.gitpod.name
  rrdatas      = [google_compute_address.gitpod.address]
  project      = var.project
}



#
# End
#

resource "null_resource" "done" {
  depends_on = [
    google_dns_record_set.gitpod
  ]
}
