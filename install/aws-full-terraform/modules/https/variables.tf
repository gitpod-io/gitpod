/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = object({
    name = string
  })
}

variable "gitpod-node-arn" {
  type = string
}

variable "dns" {
  type = object({
    domain    = string
    zone_name = string
  })
}

variable "aws" {
  type = object({
    region  = string
    profile = string
  })
}

variable "cluster_name" {
  type = string
}


variable "gitpod" {
  type = object({
    namespace  = string
    valueFiles = list(string)
  })
  default = {
    namespace  = "default"
    valueFiles = ["./values.yml"]
  }
}
variable "cert_manager" {
  type = object({
    chart     = string
    email     = string
    namespace = string
  })
}
