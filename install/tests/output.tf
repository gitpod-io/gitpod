locals {
    modop = var.cloud == "aws" ? module.eks : module.aks
}

output "storage" {
    sensitive = true
    value = try(lookup(local.modop, "storage"), {})
}

output "registry" {
    sensitive = true
    value = try(lookup(local.modop, "registry"), {})
}

output "database" {
    sensitive = true
    value = try(lookup(local.modop, "database"), {})
}

output "nameservers" {
    sensitive = true
    value = try(lookup(local.modop, "domain_nameservers"), {})
}

output "cert_manager_issuer" {
    sensitive = true
    value = try(lookup(local.modop, "cert_manager_issuer"), {})
}

output "external_dns_settings" {
    sensitive = true
    value = try(lookup(local.modop, "external_dns_settings"), {})
}
