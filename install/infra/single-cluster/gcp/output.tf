output "nameservers" {
  sensitive = false
  value     = module.gke.name_servers
}
