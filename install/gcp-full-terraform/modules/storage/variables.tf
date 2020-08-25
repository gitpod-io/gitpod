/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Project
#

variable "project" {
  type = string
}



#
# Region
#

variable "region" {
  type = string
}



#
# Location
#

variable "location" {
  type    = string
  default = "EU"
}


variable "name" {
  type    = string
  default = "gitpod-storage"
}



#
# Kubernetes
#
variable "gitpod" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "default"
  }
}


variable "minio_access_key" {
  type    = string
  default = "minio"
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
