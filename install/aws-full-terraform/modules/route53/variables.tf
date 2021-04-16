/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "dns" {
  type = object({
    domain    = string
    zone_name = string
  })
}

variable "external_dns" {
  type = string
}
