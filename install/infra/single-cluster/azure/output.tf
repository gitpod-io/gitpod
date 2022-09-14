output "url" {
  value = var.domain_name
}

output "cluster_name" {
  value = module.aks.cluster_name
}

output "registry" {
  sensitive = true
  value     = module.aks.registry
}

output "storage" {
  sensitive = true
  value     = module.aks.storage
}

output "database" {
  sensitive = true
  value     = module.aks.database
}

output "name_servers" {
  sensitive = false
  value     = module.aks.name_servers
}

output "cluster_issuer" {
  sensitive = false
  value     = module.cluster-issuer.cluster_issuer
}
