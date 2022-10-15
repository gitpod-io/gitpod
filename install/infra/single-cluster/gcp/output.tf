output "url" {
  value = var.domain_name
}

output "cluster_name" {
  value = var.cluster_name
}

output "region" {
  value = var.region
}

output "nameservers" {
  sensitive = false
  value     = module.gke.name_servers
}

output "database" {
  sensitive = true
  value     = module.gke.database
}

output "cluster_issuer" {
  sensitive = false
  value     = module.cluster-issuer.cluster_issuer
}

output "registry" {
  sensitive = true
  value     = module.gke.registry
}

output "storage" {
  sensitive = true
  value     = module.gke.storage
}

output "gke_user_key" {
  sensitive = true
  value     = try(module.gke.cluster-sa, null)
}
