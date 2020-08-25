/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Project
#

variable "project" {
  type    = string
  default = "gitpod"
}


#
# Region
#
variable "region" {
  type = string
}

#
# DNS Name
#

variable "dns_name" {
  type = string
}
