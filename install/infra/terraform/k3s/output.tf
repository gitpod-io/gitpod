output "domain_nameservers" {
  value = try(resource.google_dns_managed_zone.gitpod-zone[0].name_servers, [])
}
