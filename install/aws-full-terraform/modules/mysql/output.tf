output "instance" {
  value = local.database
}

output "values" {
  value = data.template_file.gitpod_values_database.rendered
}
