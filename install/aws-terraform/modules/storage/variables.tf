/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

variable "project" {
  type = object({
    name = string
  })
}

variable "region" {
  type = string
}

variable "worker_iam_role_name" {
  type = string
}

variable "vpc_id" {
  type = string
}
