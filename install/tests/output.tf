locals {
    cloud = var.k8s_flavor == "aks" ? module.aks : null
}

output "storage" {
    sensitive = true
    value = try(lookup(local.cloud, "storage"), {})
}

output "registry" {
    sensitive = true
    value = try(lookup(local.cloud, "registry"), {})
}

output "database" {
    sensitive = true
    value = try(lookup(local.cloud, "database"), {})
}
