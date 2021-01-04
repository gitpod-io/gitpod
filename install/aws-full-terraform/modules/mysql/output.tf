/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "instance" {
  value = local.database
}

output "values" {
  value = data.template_file.gitpod_values_database.rendered
}
