terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = ">= 1.7.0"
    }
    aws = {
        version = " ~> 3.0"
        source = "registry.terraform.io/hashicorp/aws"
    }
  }
}

resource "aws_iam_role" "eks_cluster" {
  depends_on = [data.aws_subnet_ids.subnet_ids]
  name = "iam-${var.cluster_name}"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "AmazonEKSServicePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_eks_cluster" "aws_eks" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids = data.aws_subnet_ids.subnet_ids.ids
  }

  tags = {
    Name = "EKS_tuto"
  }

  depends_on = [
    aws_iam_role.eks_cluster,
 ]
}

data "aws_eks_cluster" "cluster" {
  depends_on = [
    aws_eks_cluster.aws_eks,
  ]
  name = resource.aws_eks_cluster.aws_eks.id
}

data "aws_eks_cluster_auth" "cluster" {
  depends_on = [
    aws_eks_cluster.aws_eks,
  ]
  name = resource.aws_eks_cluster.aws_eks.id
}


resource "aws_iam_role" "eks_nodes" {
  name = "iam-ng-${var.cluster_name}"

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

resource "aws_iam_role_policy_attachment" "AmazonEKSWorkerNodePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "AmazonEKS_CNI_Policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

locals {
  map_roles = <<ROLES
- rolearn: ${aws_iam_role.eks_nodes.arn}
  username: system:node:{{EC2PrivateDNSName}}
  groups:
    - system:bootstrappers
    - system:nodes
ROLES
}

resource "aws_iam_role_policy_attachment" "AmazonSSMManagedInstanceCore" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "AmazonEC2ContainerRegistryReadOnly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "EC2InstanceProfileForImageBuilderECRContainerBuilds" {
  policy_arn = "arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_launch_template" "eks" {
  name = "${var.cluster_name}-template"
  update_default_version = true
  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size = 100
    }
  }
  credit_specification {
    cpu_credits = "standard"
  }
  ebs_optimized                        = true
  # AMI generated with packer (is private)
  image_id                             = "ami-0f08b4b1a4fd3ebe3"
  network_interfaces {
    associate_public_ip_address = false
  }
}

resource "aws_eks_node_group" "workspace" {
  cluster_name    = aws_eks_cluster.aws_eks.name
  node_group_name = "ngw-${var.cluster_name}"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = data.aws_subnet_ids.subnet_ids.ids
  instance_types  = ["m6i.2xlarge"]
  labels = {
      "gitpod.io/workload_workspace_services" = true
      "gitpod.io/workload_workspace_regular"  = true
      "gitpod.io/workload_workspace_headless" = true
      "gitpod.io/workload_meta" = true
      "gitpod.io/workload_ide"  = true
  }

  scaling_config {
    desired_size = 1
    max_size     = 10
    min_size     = 1
  }

  # Ensure that IAM Role permissions are created before and deleted after EKS Node Group handling.
  # Otherwise, EKS will not be able to properly delete EC2 Instances and Elastic Network Interfaces.
  depends_on = [
    resource.aws_iam_role_policy_attachment.AmazonSSMManagedInstanceCore,
    resource.aws_iam_role_policy_attachment.AmazonEC2ContainerRegistryReadOnly,
    resource.aws_iam_role_policy_attachment.EC2InstanceProfileForImageBuilderECRContainerBuilds,
  ]

  launch_template {
    id = resource.aws_launch_template.eks.id
    version = aws_launch_template.eks.latest_version
  }
}

provider "kubectl" {
  host                   = resource.aws_eks_cluster.aws_eks.endpoint
  cluster_ca_certificate = base64decode(resource.aws_eks_cluster.aws_eks.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
  config_path            = var.kubeconfig
}

output host {
  value = resource.aws_eks_cluster.aws_eks.endpoint
}

output ca {
  sensitive = true
  value = base64decode(resource.aws_eks_cluster.aws_eks.certificate_authority[0].data)
}

output token {
  sensitive = true
  value = data.aws_eks_cluster_auth.cluster.token
}
