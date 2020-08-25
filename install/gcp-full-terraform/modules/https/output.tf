/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "values" {
  value = data.template_file.gitpod_https_values.rendered
}

output "done" {
  value = null_resource.done.id
}
