output "database" {
    sensitive = true
    value = module.k3s.database
}

output "registry" {
    sensitive = true
    value = module.k3s.registry
}

output "storage" {
    sensitive = true
    value = module.k3s.storage
}

output "url" {
  value = var.domain_name
}

output "cluster_issuer" {
  value     = module.cluster-issuer.cluster_issuer
}
