/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Variables
#

variable "project" {
  type = string
}

variable "cert_manager" {
  type = object({
    name       = string
    namespace  = string
    chart      = string
    repository = string
  })
  default = {
    name       = "cert-manger"
    namespace  = "cert-manager"
    chart      = "cert-manager"
    repository = "https://charts.jetstack.io"
  }
}

variable "certificate_email" {
  type = string
}

variable "dns_name" {
  type = string
}

variable "gitpod" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "gitpod"
  }
}

variable "kubeconfig" {
  type = string
}

variable "requirements" {
  type = object({
    kubernetes = string
    dns        = string
  })
}
