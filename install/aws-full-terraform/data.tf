/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# AZ lookup
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_route53_zone" "selected" {
  name         = var.dns.zone_name
  private_zone = false
}

# For the Kubernetes and Helm providers
# https://www.terraform.io/docs/providers/aws/d/eks_cluster_auth.html
data "aws_eks_cluster_auth" "default" {
  name = module.kubernetes.cluster_id
}

data "aws_eks_cluster" "gitpod_cluster" {
  name = module.kubernetes.cluster_id
}
