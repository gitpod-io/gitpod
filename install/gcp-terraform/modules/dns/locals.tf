locals {
  hostname = trimsuffix("${var.subdomain}.${data.google_dns_managed_zone.gitpod.dns_name}", ".")
}