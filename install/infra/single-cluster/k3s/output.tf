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
