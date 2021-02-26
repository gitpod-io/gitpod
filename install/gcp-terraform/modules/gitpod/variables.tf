/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


variable "project" {
  type = string
}

variable "database_values" {
  type    = string
  default = ""
}

variable "storage_values" {
  type    = string
  default = ""
}

variable "registry_values" {
  type    = string
  default = ""
}

variable "dns_values" {
  type    = string
  default = ""
}

variable "certificate_values" {
  type    = string
  default = ""
}

variable "namespace" {
  type    = string
  default = "default"
}

variable "values" {
  type    = string
  default = ""
}

variable "gitpod" {
  type = object({
    repository   = string
    chart        = string
    version      = string
    image_prefix = string
  })
}

variable "license" {
  type    = string
  default = ""
}
