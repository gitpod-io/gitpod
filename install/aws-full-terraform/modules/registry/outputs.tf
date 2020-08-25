output "output" {
  value = local.registry
}

output "values" {
  value = data.template_file.gitpod_registry_values.rendered
}