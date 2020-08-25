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

variable "name" {
    type    = string
    default = "gitpod-database"
}

variable "namespace" {
    type    = string
    default = "default"
}

variable "database" {
    type    = object({
        name       = string
        username   = string
        chart      = string
        repository = string
        version    = string
    })
    default = {
        name       = "gitpod-database"
        username   = "gitpod"
        chart      = "mysql"
        repository = "https://kubernetes-charts.storage.googleapis.com"
        version    = "1.6.6"
    }
}


variable "requirements" {
  type = object({
    kubernetes = string
  })
}
