/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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

variable "certificate_email" {
  type = string
}

variable "chart_location" {
  type    = string
  default = "../../chart"
}

variable "image_version" {
  type = string
}

variable "image_prefix" {
  type    = string
  default = "eu.gcr.io/gitpod-core-dev/build/"
}

variable "force_https" {
    type = bool
    default = false
}