/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = string
}

variable "region" {
  type = string
}

variable "domain" {
  type        = string
  default     = "ip.mygitpod.com"
  description = "domain at which the installation will be available"
}

variable "kubernetes" {
  type = object({
    namespace = string
  })
  default = {
    namespace = "default"
  }
}


variable "chart_location" {
  type    = string
  default = "../../../../chart"
}

variable "image_version" {
  type = string
}

variable "image_prefix" {
  type    = string
  default = "eu.gcr.io/gitpod-core-dev/build/"
}

variable "certbot_enabled" {
  type    = bool
  default = false
}

variable "certificate_email" {
  type    = string
  default = "someone@somewhere.com"
}
