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
# Region/Zone
#

variable "location" {
  type = string
}



#
# GKE Cluster Name
#

variable "name" {
  type    = string
  default = "gitpod-cluster"
}

variable "username" {
  type    = string
  default = "admin"
}


#
# Network Name
#

variable "network" {
  type    = string
}

variable "subnets" {
  type = list(string)
}

#
# 
#

variable "gitpod" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "gitpod"
  }
}


variable "kubernetes" {
  type = object({
    initial_node_count = number
    node_pool = object({
      preemptible     = bool
      machine_type    = string
      disk_size_gb    = number
      disk_type       = string
      local_ssd_count = number
      image_type      = string
    })
  })
  default = {
    initial_node_count = 1
    node_pool = {
      preemptible     = false
      machine_type    = "n1-standard-8"
      disk_size_gb    = 100
      disk_type       = "pd-standard"
      local_ssd_count = 1
      image_type      = "COS_CONTAINERD"
    }
  }
}

variable "requirements" {
  type = object({
    network = string
  })
}
