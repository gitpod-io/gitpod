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
# Network ID
#

variable "network" {
  type = object({
    id   = string
    name = string
  })
}

variable "subnets" {
  type = list(string)
}

variable "serviceaccount" {
  type    = string
  default = "gitpod-database"
}

variable "database" {
  type = object({
    version   = string
    tier      = string
    disk_type = string
    disk_size = number
    charset   = string
    collation = string
    tables    = list(string)
    username  = string
    name      = string
  })
  default = {
    version   = "MYSQL_5_7"
    tier      = "db-f1-micro"
    disk_type = "PD_SSD"
    disk_size = 10
    charset   = "utf8mb4"
    collation = "utf8mb4_bin"
    tables = [
      "gitpod",
      "gitpod-sessions",
    ]
    username = "gitpod"
    name     = "gitpod-database"
  }
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
    namespace = string
  })
  default = {
    namespace = "default"
  }
}

variable "requirements" {
  type = object({
    kubernetes = string
  })
}
