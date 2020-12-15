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

variable "name" {
  type = string
}

variable "network" {
  type = string
}

variable "subnet" {
  type = object({
    name = string
    cidr = string
  })
  default = {
    name = "gitpod-subnet"
    cidr = "10.23.0.0/16"
  }
}