# https://www.terraform.io/docs/providers/google/guides/provider_reference.html
provider "google" {
  project = "gitpod-dev"
  region  = "europe-west-3"
  # Relies on GOOGLE_APPLICATION_CREDENTIALS pointing to the service account file
}

# Added for compatibility with old branches, can be deleted if compatibility is not needed
provider "kubectl" {
  load_config_file       = true
}

locals {
  # As we did create the zone and IP manually beforehand: have the zone name statically determined
  dns_zone_name  = replace(trimsuffix(var.dns_zone_domain, ".-"), ".", "-")
  project        = "gitpod-dev"
  region         = "europe-west-3"
}

#
# DNS records
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set
resource "google_dns_record_set" "gitpod" {
  count        = length(var.ingress_subdomains)
  name         = "${var.ingress_subdomains[count.index]}${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = local.dns_zone_name
  rrdatas      = [var.ingress_ip]
  project      = local.project
}
resource "google_dns_record_set" "gitpod_ws" {
  name         = "${var.ws_proxy_subdomain}${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = local.dns_zone_name
  rrdatas      = [var.ws_proxy_ip]
  project      = local.project
}

#
# End
#
resource "null_resource" "done" {
  depends_on = [
    google_dns_record_set.gitpod,
    google_dns_record_set.gitpod_ws,
  ]
}


output "done" {
  value = null_resource.done.id
}
