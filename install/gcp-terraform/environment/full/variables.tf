/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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

variable "zone_name" {
  type = string
}

variable "namespace" {
  type    = string
  default = "default"
}

variable "certificate_email" {
  type = string
}

variable "license" {
  type    = string
  default = ""
}

variable "database" {
  type = object({
    name = string
  })
  default = {
    name = "db"
  }
}

variable "subdomain" {
  type    = string
  default = "gitpod"
}
