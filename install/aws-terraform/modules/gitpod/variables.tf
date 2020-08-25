/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "gitpod" {
  type = object({
    valuesFiles = list(string)
    namespace   = string
  })
  default = {
    valuesFiles = []
    namespace   = "default"
  }
}

variable "helm" {
  type = object({
    chart = string
  })
}

variable "domain_name" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "auth_providers" {
  type = list(
    object({
      id            = string
      host          = string
      client_id     = string
      client_secret = string
      settings_url  = string
      callback_url  = string
      protocol      = string
      type          = string
    })
  )
}

variable "values" {
  type = list(string)
}