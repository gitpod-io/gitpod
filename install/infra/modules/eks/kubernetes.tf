locals {
  private_primary_subnet_cidr   = cidrsubnet(var.vpc_cidr, 7, 0)
  private_secondary_subnet_cidr = cidrsubnet(var.vpc_cidr, 7, 1)
  public_primary_subnet_cidr    = cidrsubnet(var.vpc_cidr, 7, 2)
  public_secondary_subnet_cidr  = cidrsubnet(var.vpc_cidr, 7, 3)
  public_db_subnet_cidr_1       = cidrsubnet(var.vpc_cidr, 7, 4)
  public_db_subnet_cidr_2       = cidrsubnet(var.vpc_cidr, 7, 5)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "3.12.0"

  name                 = "vpc-${var.cluster_name}"
  cidr                 = var.vpc_cidr
  azs                  = var.vpc_availability_zones
  private_subnets      = [local.private_primary_subnet_cidr, local.private_secondary_subnet_cidr]
  public_subnets       = [local.public_primary_subnet_cidr, local.public_secondary_subnet_cidr, local.public_db_subnet_cidr_1, local.public_db_subnet_cidr_2]
  enable_nat_gateway   = true
  enable_dns_hostnames = true
}

resource "aws_security_group_rule" "eks-worker-ingress-self" {
  description              = "Allow node to communicate with each other"
  from_port                = 0
  protocol                 = "-1"
  security_group_id        = aws_security_group.nodes.id
  source_security_group_id = aws_security_group.nodes.id
  to_port                  = 65535
  type                     = "ingress"
}

resource "aws_security_group_rule" "eks-worker-ingress-cluster" {
  description              = "Allow worker Kubelets and pods to receive communication from the cluster control plane"
  from_port                = 1025
  protocol                 = "tcp"
  security_group_id        = aws_security_group.nodes.id
  source_security_group_id = aws_security_group.nodes.id
  to_port                  = 65535
  type                     = "ingress"
}

### Worker Node Access to EKS Master
resource "aws_security_group_rule" "eks-cluster-ingress-node-https" {
  description              = "Allow pods to communicate with the cluster API Server"
  from_port                = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.nodes.id
  source_security_group_id = aws_security_group.nodes.id
  to_port                  = 443
  type                     = "ingress"
}


resource "aws_security_group" "nodes" {
  name   = "nodes-sg-${var.cluster_name}"
  vpc_id = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "random_string" "ng_role_suffix" {
  upper   = false
  lower   = true
  special = false
  length  = 4
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "18.8.1"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnets

  cluster_addons = {
    coredns = {
      resolve_conflicts = "OVERWRITE"
    }
    kube-proxy = {}
    vpc-cni = {
      resolve_conflicts        = "OVERWRITE"
      service_account_role_arn = module.vpc_cni_irsa.iam_role_arn
    }
  }

  eks_managed_node_group_defaults = {
    ami_type                   = "CUSTOM"
    iam_role_attach_cni_policy = true
    iam_role_use_name_prefix   = false
    ami_id                     = var.image_id
    enable_bootstrap_user_data = true
    vpc_security_group_ids     = [aws_security_group.nodes.id]
    ebs_optimized              = true

    post_bootstrap_user_data = <<-EOT
      #!/bin/bash
      cat << CONFIG >> /etc/containerd/config.toml

      [plugins."io.containerd.grpc.v1.cri".registry]
      config_path = "/etc/containerd/certs.d"

      CONFIG

      service containerd restart
      EOT
  }

  eks_managed_node_groups = {
    Services = {
      enable_bootstrap_user_data = true
      instance_types             = [var.service_machine_type]
      name                       = "service-${var.cluster_name}"
      iam_role_name              = format("%s-%s", substr("${var.cluster_name}-svc-ng", 0, 58), random_string.ng_role_suffix.result)
      subnet_ids                 = module.vpc.public_subnets
      min_size                   = 1
      max_size                   = 4
      desired_size               = 2
      block_device_mappings = [{
        device_name = "/dev/sda1"

        ebs = [{
          volume_size           = 300
          volume_type           = "gp3"
          throughput            = 500
          iops                  = 6000
          delete_on_termination = true
        }]
      }]
      labels = {
        "gitpod.io/workload_meta"               = true
        "gitpod.io/workload_ide"                = true
        "gitpod.io/workload_workspace_services" = true
        "gitpod.io/workload_services"           = true
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled" = true
        "k8s.io/cluster-autoscaler/gitpod"  = "owned"
      }

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex
        cat <<-EOF > /etc/profile.d/bootstrap.sh
        export CONTAINER_RUNTIME="containerd"
        export USE_MAX_PODS=false
        EOF
        # Source extra environment variables in bootstrap script
        sed -i '/^set -o errexit/a\\nsource /etc/profile.d/bootstrap.sh' /etc/eks/bootstrap.sh
        EOT
    }

    RegularWorkspaces = {
      instance_types = [var.workspace_machine_type]
      name           = "ws-regular-${var.cluster_name}"
      iam_role_name  = format("%s-%s", substr("${var.cluster_name}-regular-ws-ng", 0, 58), random_string.ng_role_suffix.result)
      subnet_ids     = module.vpc.public_subnets
      min_size       = 1
      max_size       = 50
      block_device_mappings = [{
        device_name = "/dev/sda1"

        ebs = [{
          volume_size           = 512
          volume_type           = "gp3"
          throughput            = 500
          iops                  = 6000
          delete_on_termination = true
        }]
      }]
      desired_size               = 2
      enable_bootstrap_user_data = true
      labels = {
        "gitpod.io/workload_workspace_regular" = true
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled" = true
        "k8s.io/cluster-autoscaler/gitpod"  = "owned"
      }

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex
        cat <<-EOF > /etc/profile.d/bootstrap.sh
        export CONTAINER_RUNTIME="containerd"
        export USE_MAX_PODS=false
        EOF
        # Source extra environment variables in bootstrap script
        sed -i '/^set -o errexit/a\\nsource /etc/profile.d/bootstrap.sh' /etc/eks/bootstrap.sh
        EOT
    }

    HeadlessWorkspaces = {
      instance_types = [var.workspace_machine_type]
      name           = "ws-headless-${var.cluster_name}"
      iam_role_name  = format("%s-%s", substr("${var.cluster_name}-headless-ws-ng", 0, 58), random_string.ng_role_suffix.result)
      subnet_ids     = module.vpc.public_subnets
      min_size       = 1
      max_size       = 50
      block_device_mappings = [{
        device_name = "/dev/sda1"

        ebs = [{
          volume_size           = 512
          volume_type           = "gp3"
          throughput            = 500
          iops                  = 6000
          delete_on_termination = true
        }]
      }]
      desired_size               = 2
      enable_bootstrap_user_data = true
      labels = {
        "gitpod.io/workload_workspace_headless" = true
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled" = true
        "k8s.io/cluster-autoscaler/gitpod"  = "owned"
      }

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex
        cat <<-EOF > /etc/profile.d/bootstrap.sh
        export CONTAINER_RUNTIME="containerd"
        export USE_MAX_PODS=false
        EOF
        # Source extra environment variables in bootstrap script
        sed -i '/^set -o errexit/a\\nsource /etc/profile.d/bootstrap.sh' /etc/eks/bootstrap.sh
        EOT
    }
  }
}

module "vpc_cni_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 4.12"

  role_name_prefix      = "VPC-CNI-IRSA"
  attach_vpc_cni_policy = true
  vpc_cni_enable_ipv4   = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node"]
    }
  }
}

resource "null_resource" "kubeconfig" {
  depends_on = [module.eks]
  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --region ${var.region} --name ${var.cluster_name} --kubeconfig ${var.kubeconfig}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

data "aws_iam_policy_document" "eks_policy" {
  statement {
    actions = [
      "eks:DescribeCluster",
      "eks:ListClusters"
    ]
    resources = [
      "*",
    ]
    effect = "Allow"
  }
}

resource "aws_iam_policy" "eks_policy" {
  name        = "eks-policy-${var.cluster_name}"
  description = "Gitpod ${var.cluster_name} EKS cluster access bucket policy"
  policy      = data.aws_iam_policy_document.eks_policy.json
}

resource "aws_iam_user" "eks_user" {
  force_destroy = true
  name          = "eks-user-${var.cluster_name}"
}

resource "aws_iam_user_policy_attachment" "eks_attachment" {
  user       = aws_iam_user.eks_user.name
  policy_arn = aws_iam_policy.eks_policy.arn
}

resource "aws_iam_access_key" "eks_user_key" {
  user = aws_iam_user.eks_user.name
}
