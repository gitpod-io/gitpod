/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "output" {
  value = local.registry
}

output "values" {
  value = data.template_file.gitpod_registry_values.rendered
}