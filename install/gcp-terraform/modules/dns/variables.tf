/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = string
}

variable "region" {
  type = string
}

variable "zone_name" {
  type = string
}

variable "name" {
  type = string
}

variable "subdomain" {
  type    = string
  default = "gitpod"
}

variable "gitpod" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "default"
  }
}