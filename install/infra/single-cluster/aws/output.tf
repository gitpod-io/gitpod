output "aws_storage" {
  sensitive = true
  value     = module.eks.storage
}

output "aws_registry" {
  sensitive = true
  value     = module.eks.registry
}

output "aws_database" {
  sensitive = true
  value     = module.eks.database
}

output "nameservers" {
  sensitive = false
  value     = module.eks.domain_nameservers
}
