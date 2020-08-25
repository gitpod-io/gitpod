/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


variable "project" {
  type        = string
  description = "GCP project"
}

variable "location" {
  type        = string
  description = "Region/Zone"
}

variable "name" {
  type        = string
  description = "GKE Cluster Name"
  default     = "gitpod-cluster"
}

variable "username" {
  type    = string
  default = "admin"
}

variable "network" {
  type        = string
  description = "name of the GCP network this cluster runs in"
}

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
