/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    mysql = {
      source = "terraform-providers/mysql"
    }
  }
  required_version = ">= 0.13"
}
