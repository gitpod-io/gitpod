/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type        = string
  default     = "self-hosted"
  description = "This is used in the naming of some resources"
}

variable "region" {
  type        = string
  description = "The AWS region that resources should be created in"
}

variable "domain" {
  type        = string
  description = "The domain that Gitpod should be installed on"
}

variable "chart_location" {
  type    = string
  default = "../../chart"
}

variable "image_version" {
  type        = string
  description = "The version of which to install Gitpod i.e. v0.4.0"
}

variable "image_prefix" {
  type        = string
  default     = "eu.gcr.io/gitpod-core-dev/build/"
  description = "Image prefix for the registry in which the images for the components are hosted"
}

variable "force_https" {
  type        = bool
  default     = false
  description = "Force the domain to use HTTPS"
}

variable "certbot_enabled" {
  type        = bool
  default     = false
  description = "Have Certbot issue certificates"
}

variable "certificate_email" {
  type        = string
  default     = "someone@somewhere.com"
  description = "Email to associate A Letsencrypt on (Set this if you set certbot_enabled to true)"
}
