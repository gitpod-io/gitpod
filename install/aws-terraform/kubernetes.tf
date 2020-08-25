/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# Derived from https://learn.hashicorp.com/terraform/kubernetes/provision-eks-cluster
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "2.44.0"

  name                 = "gitpod"
  cidr                 = "10.0.0.0/16"
  azs                  = data.aws_availability_zones.available.names
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets       = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  tags = {
    "kubernetes.io/cluster/${local.kubernetes.cluster_name}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${local.kubernetes.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                                 = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${local.kubernetes.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"                        = "1"
  }
}

module "kubernetes" {
  source             = "terraform-aws-modules/eks/aws"
  cluster_name       = local.kubernetes.cluster_name
  cluster_version    = local.kubernetes.version
  subnets            = module.vpc.public_subnets
  write_kubeconfig   = true
  config_output_path = local.config_output_path
  vpc_id             = module.vpc.vpc_id

  # Valid options: https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/local.tf#L36
  worker_groups = [
    {
      instance_type     = local.kubernetes.instance_type
      asg_max_size      = local.kubernetes.max_node_count
      asg_min_size      = local.kubernetes.min_node_count
      placement_tenancy = "default"

      tags = [
        # These tags are required for the cluster-autoscaler to discover this ASG
        {
          "key"                 = "k8s.io/cluster-autoscaler/${local.kubernetes.cluster_name}"
          "value"               = "true"
          "propagate_at_launch" = true
        },
        {
          "key"                 = "k8s.io/cluster-autoscaler/enabled"
          "value"               = "true"
          "propagate_at_launch" = true
        }
      ]
    }
  ]
}

resource "null_resource" "kubeconfig" {
  provisioner "local-exec" {
    command = "AWS_DEFAULT_REGION=${var.region} aws eks update-kubeconfig --name $CLUSTER"
    environment = {
      CLUSTER = local.kubernetes.cluster_name
    }
  }
  depends_on = [
    module.kubernetes
  ]
}


# Autoscaling for a cluster created with "terraform-aws-modules/eks/aws"
# Source: https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/autoscaling.md
resource "aws_iam_role_policy_attachment" "workers_autoscaling" {
  policy_arn = aws_iam_policy.worker_autoscaling.arn
  role       = module.kubernetes.worker_iam_role_name #[0]
}

resource "aws_iam_policy" "worker_autoscaling" {
  name_prefix = "eks-worker-autoscaling-${module.kubernetes.cluster_id}"
  description = "EKS worker node autoscaling policy for cluster ${module.kubernetes.cluster_id}"
  policy      = data.aws_iam_policy_document.worker_autoscaling.json
  #   path        = var.iam_path
}

data "aws_iam_policy_document" "worker_autoscaling" {
  statement {
    sid    = "eksWorkerAutoscalingAll"
    effect = "Allow"

    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeTags",
      "ec2:DescribeLaunchTemplateVersions",
    ]

    resources = ["*"]
  }

  statement {
    sid    = "eksWorkerAutoscalingOwn"
    effect = "Allow"

    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup",
      "autoscaling:UpdateAutoScalingGroup",
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "autoscaling:ResourceTag/kubernetes.io/cluster/${module.kubernetes.cluster_id}"
      values   = ["owned"]
    }

    condition {
      test     = "StringEquals"
      variable = "autoscaling:ResourceTag/k8s.io/cluster-autoscaler/enabled"
      values   = ["true"]
    }
  }
}



# Loosely following: https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/autoscaling.md
# https://www.terraform.io/docs/providers/helm/r/release.html
resource "helm_release" "autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes-charts.storage.googleapis.com"
  chart      = "cluster-autoscaler"

  namespace        = "cluster-autoscaler"
  create_namespace = true
  recreate_pods    = true
  wait             = true

  values = [
    # TODO [geropl] Make sure the tag below is in line with local.kubernetes.version and references a valid (minor) version
    <<-EOT
      rbac:
        create: true

      cloudProvider: aws
      awsRegion: ${var.region}

      autoDiscovery:
        clusterName: ${local.kubernetes.cluster_name}
        enabled: true

      image:
        repository: eu.gcr.io/k8s-artifacts-prod/autoscaling/cluster-autoscaler
        tag: v1.16.5
    EOT
  ]

  depends_on = [
    module.kubernetes
  ]
}
