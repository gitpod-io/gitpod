variable "domain_name" {}
variable "cluster_name" {}

terraform {
  required_providers {
    aws = {
        version = " ~> 3.0"
        source = "registry.terraform.io/hashicorp/aws"
    }
  }
}

provider "aws" {
  region  = "eu-west-1"
}

resource "aws_route53_zone" "gitpod" {
  name = var.domain_name

  tags = {
    Environment = "test"
  }
}

resource "aws_iam_policy" "gitpod" {
  name = "role-${var.cluster_name}"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
        {
            Effect = "Allow",
            Action = [
                "route53:ChangeResourceRecordSets"
            ],
            Resource = [
                "arn:aws:route53:::hostedzone/*"
            ]
        },
        {
            Effect = "Allow",
            Action = [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets"
            ],
            Resource = [ "*" ]
        }
    ],
  })
}

resource "aws_iam_role" "gitpod" {
  name = "iam-route53-${var.cluster_name}"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "route53" {
  policy_arn = resource.aws_iam_policy.gitpod.arn
  role       = aws_iam_role.gitpod.name
}
