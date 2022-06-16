module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "3.12.0"

  name               = "vpc-${var.cluster_name}"
  cidr               = var.vpc_cidr
  azs                = var.vpc_availability_zones
  private_subnets    = [var.private_primary_subnet_cidr, var.private_secondary_subnet_cidr]
  public_subnets     = [var.public_primary_subnet_cidr, var.public_secondary_subnet_cidr, var.public_db_subnet_cidr_1, var.public_db_subnet_cidr_2]
  enable_nat_gateway = true
  enable_dns_hostnames = true
}

resource "aws_security_group" "nodes" {
  name = "nodes-sg-${var.cluster_name}"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "18.8.1"

  cluster_name                    = var.cluster_name
  cluster_version                 = "1.22"

  cluster_endpoint_public_access  = true

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
    disk_size                  = 150
    ami_type                   = "CUSTOM"
    iam_role_attach_cni_policy = true
    ami_id                     = var.image_id
    enable_bootstrap_user_data = true
    vpc_security_group_ids = [aws_security_group.nodes.id]
  }

  eks_managed_node_groups = {
    Services = {
      enable_bootstrap_user_data = true
      instance_types = [var.service_machine_type]
      name = "service-${var.cluster_name}"
      subnet_ids   = module.vpc.public_subnets
      min_size     = 1
      max_size     = 10
      desired_size = 1
      labels = {
        "gitpod.io/workload_meta" = true
        "gitpod.io/workload_ide"  = true
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

    Workspaces = {
      instance_types = [var.workspace_machine_type]
      name = "ws-${var.cluster_name}"
      subnet_ids   = module.vpc.public_subnets
      min_size     = 1
      max_size     = 10
      desired_size = 1
      enable_bootstrap_user_data = true
      labels = {
        "gitpod.io/workload_workspace_services" = true
        "gitpod.io/workload_workspace_regular"  = true
        "gitpod.io/workload_workspace_headless" = true
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
  depends_on = [ module.eks ]
  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --region ${var.region} --name ${var.cluster_name} --kubeconfig ${var.kubeconfig}"
  }

  lifecycle {
    create_before_destroy = true
  }
}
