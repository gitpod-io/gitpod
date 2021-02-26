/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = string
}

variable "location" {
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

variable "dns_prefixes" {
  type    = list(string)
  default = ["", "*"]
}

variable "gitpod" {
  type = object({
    namespace = string
    shortname = string
  })
  default = {
    namespace = "default"
    shortname = ""
  }
}