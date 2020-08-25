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

variable "container_registry" {
  type = object({
    location = string
  })
}

variable "dns_name" {
  type        = string
  description = "domain at which the installation will be available"
}

variable "kubernetes" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "default"
  }
}

variable "certificate_email" {
  type = string
}


variable "license" {
  type    = string
  default = ""
}
