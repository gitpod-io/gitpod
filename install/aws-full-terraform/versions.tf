/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

terraform {
  backend "s3" {}
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "1.6.1"
    }
    helm = {
      source  = "hashicorp/helm"
    }
  }
  required_version = ">= 0.13"
}
