/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "region" {
  type = string
}

variable "name" {
  type    = string
  default = "gitpod-database"
}

variable "username" {
  type    = string
  default = "gitpod"
}

variable "network" {
  type = object({
    id   = string
    name = string
  })
}

variable "gitpod" {
  type = object({
    serviceaccount = string
    namespace      = string
  })
  default = {
    serviceaccount = "gitpod-database"
    namespace      = "default"
  }
}
