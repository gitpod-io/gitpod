/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

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
