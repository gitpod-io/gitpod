/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = string
}

variable "certmanager" {
  type = object({
    name       = string
    namespace  = string
    chart      = string
    repository = string
    crds_url   = string
    crds       = bool
  })
  default = {
    name       = "certmanger"
    namespace  = "certmanager"
    chart      = "cert-manager"
    version    = "v1.1.0"
    repository = "https://charts.jetstack.io"
    crds_url   = "https://github.com/jetstack/cert-manager/releases/download/v1.1.0/cert-manager.yaml"
    crds       = true
  }
}

variable "email" {
  type = string
}

variable "domain" {
  type = string
}

variable "shortname" {
  type    = string
  default = ""
}

variable "certificate" {
  type = object({
    name      = string
    namespace = string
  })
  default = {
    name      = "gitpod-certificate"
    namespace = "default"
  }
}
