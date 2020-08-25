data "template_file" "gitpod_values_main" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    domain_name = var.domain_name
  }
}

data "template_file" "gitpod_values_auth_provider" {
  template = file("${path.module}/templates/auth_provider.tpl")
  vars = {
    auth_providers = jsonencode(var.auth_providers)
  }
}
