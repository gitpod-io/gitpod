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

variable "kubernetes" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "gitpod"
  }
}

variable "hostname" {
  type = string
}

variable "loadBalancerIP" {
  type = string
}

variable "path" {
  type = string
}

variable "values" {
  type = list(string)
}

variable "requirements" {
  type = list(string)
}

variable "gitpod" {
  type = object({
    license = string
  })
  default = {
    license = ""
  }
}

variable "forceHTTPS" {
  type = bool
  default = false
}
