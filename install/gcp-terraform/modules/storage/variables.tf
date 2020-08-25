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

variable "gitpod" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "default"
  }
}

variable "kubernetes" {
  type = object({
    enabled   = bool
    namespace = string
  })
  default = {
    enabled   = true
    namespace = "default"
  }
}

variable "requirements" {
  type = object({
    kubernetes = string
  })
}
