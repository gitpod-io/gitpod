/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "ready" {
  value = ""
  depends_on = [
    null_resource.wait_for_certs
  ]
}
