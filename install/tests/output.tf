output "gke_database" {
  sensitive = true
  value     = try(module.gke.database, null)
}

output "gke_user_key" {
  sensitive = true
  value     = try(module.gke.cluster-sa, null)
}

output "k3s_database" {
  sensitive = true
  value     = try(module.k3s.database, null)
}

output "aws_cluster_user" {
  sensitive = true
  value     = try(module.eks.cluster_user, null)
}

output "aws_storage" {
  sensitive = true
  value     = try(module.eks.storage, null)
}

output "aws_registry" {
  sensitive = true
  value     = try(module.eks.registry, null)
}

output "aws_database" {
  sensitive = true
  value     = try(module.eks.database, null)
}

output "aws_s3_registry_backend" {
  sensitive = true
  value     = try(module.eks.registry_backend, null)
}

output "azure_database" {
  sensitive = true
  value     = try(module.aks.database, null)
}

output "azure_registry" {
  sensitive = true
  value     = try(module.aks.registry, null)
}

output "azure_storage" {
  sensitive = true
  value     = try(module.aks.storage, null)
}
