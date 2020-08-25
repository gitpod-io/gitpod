variable "project" {
  type = object({
    name = string
  })
}

variable "gitpod-node-arn" {
  type = string
}

variable "dns" {
  type = object({
    domain    = string
    zone_name = string
  })
}

variable "aws" {
  type = object({
    region  = string
    profile = string
  })
}

variable "cluster_name" {
  type = string
}


variable "gitpod" {
  type = object({
    valuesFile = string
    namespace  = string
  })
}

variable "cert_manager" {
  type = object({
    chart     = string
    email     = string
    namespace = string
  })
}
