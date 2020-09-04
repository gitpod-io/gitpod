/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Registry
#
locals {
  secret_name = "gitpod-registry"
}

resource "aws_ecr_repository" "gitpod_registry" {
  name                 = "workspace-images"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
  tags = {
    project = var.project.name
  }
}

resource "aws_ecr_repository" "gitpod_registry_base" {
  name                 = "base-images"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
  tags = {
    project = var.project.name
  }
}


resource "aws_iam_role_policy" "dns_manager" {
  name = "${var.project.name}-registry"

  policy = <<-EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:*",
                "cloudtrail:LookupEvents"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer",
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        }
    ]
}
EOF
  role   = var.worker_iam_role_name
}


data "aws_ecr_authorization_token" "gitpod_registry" {
  registry_id = aws_ecr_repository.gitpod_registry.registry_id
}


#
# file: secrets/registry-auth.json
#

data "template_file" "gitpod_registry_auth" {
  template = file("${path.module}/templates/registry-auth.tpl")
  vars = {
    host = aws_ecr_repository.gitpod_registry.repository_url
    auth = data.aws_ecr_authorization_token.gitpod_registry.authorization_token
  }
}


resource "kubernetes_secret" "gitpod_registry_auth" {
  metadata {
    name      = local.secret_name
    namespace = var.gitpod.namespace
  }

  data = {
    ".dockerconfigjson" = data.template_file.gitpod_registry_auth.rendered
  }

  type = "kubernetes.io/dockerconfigjson"
}


data "template_file" "gitpod_registry_values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    host        = "${aws_ecr_repository.gitpod_registry.registry_id}.dkr.ecr.${var.region}.amazonaws.com"
    secret_name = local.secret_name
  }
}
