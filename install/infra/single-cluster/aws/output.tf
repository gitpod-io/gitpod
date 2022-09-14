output "url" {
  value = var.domain_name
}

output "cluster_name" {
  value     = var.cluster_name
}

output "registry_backend" {
  sensitive = true
  value     = module.eks.registry_backend
}

output "storage" {
  sensitive = true
  value     = module.eks.storage
}

output "database" {
  sensitive = true
  value     = module.eks.database
}

output "nameservers" {
  sensitive = false
  value     = module.eks.name_servers
}

output "cluster_issuer" {
  sensitive = false
  value     = module.cluster-issuer.cluster_issuer
}
