# Derived from https://learn.hashicorp.com/terraform/kubernetes/provision-eks-cluster
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "2.44.0"

  name                 = var.vpc.name
  cidr                 = "10.0.0.0/16"
  azs                  = data.aws_availability_zones.available.names
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets       = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  tags = {
    "kubernetes.io/cluster/${var.kubernetes.cluster_name}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.kubernetes.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                               = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.kubernetes.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"                      = "1"
  }
}

module "kubernetes" {
  source             = "terraform-aws-modules/eks/aws"
  cluster_name       = var.kubernetes.cluster_name
  cluster_version    = var.kubernetes.version
  subnets            = module.vpc.public_subnets
  write_kubeconfig   = true
  config_output_path = "${var.kubernetes.home_dir}/.kube/config"
  vpc_id             = module.vpc.vpc_id

  worker_groups = [for i in range(var.kubernetes.node_count) : {
    instance_type = var.kubernetes.instance_type
    asg_max_size  = 5
  }]
}

resource "null_resource" "kubeconfig" {
  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --name $CLUSTER"
    environment = {
      CLUSTER = var.kubernetes.cluster_name
    }
  }
  depends_on = [
    module.kubernetes
  ]
}

module "cert-manager" {
  source          = "./modules/https"
  gitpod-node-arn = module.kubernetes.worker_iam_role_arn
  cluster_name    = module.kubernetes.cluster_id
  dns             = var.dns
  aws             = var.aws
  cert_manager    = var.cert_manager
  gitpod          = var.gitpod

  project = var.project

  providers = {
    local   = local
    kubectl = kubectl
  }
}

module "database" {
  source = "./modules/mysql"

  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnets
  security_group_id = module.kubernetes.worker_security_group_id
  database          = var.database

  project = var.project
  gitpod  = var.gitpod

}



module "registry" {
  source               = "./modules/registry"
  project              = var.project
  gitpod               = var.gitpod
  region               = var.aws.region
  worker_iam_role_name = module.kubernetes.worker_iam_role_name

  depends_on = [module.kubernetes.cluster_id]
}

module "storage" {
  source               = "./modules/storage"
  project              = var.project
  region               = var.aws.region
  worker_iam_role_name = module.kubernetes.worker_iam_role_name
  vpc_id               = module.vpc.vpc_id

  depends_on = [
    module.kubernetes.cluster_id
  ]
}



#
# Gitpod
#

module "gitpod" {
  source       = "./modules/gitpod"
  gitpod       = var.gitpod
  domain_name  = var.dns.domain
  cluster_name = module.kubernetes.cluster_id

  providers = {
    helm       = helm
    kubernetes = kubernetes
  }

  auth_providers = var.auth_providers

  helm = {
    repository = "${path.root}/../../"
    chart      = "chart"
  }

  values = [
    module.registry.values,
    module.storage.values,
    module.database.values
  ]

  depends_on = [
    module.kubernetes.cluster_id,
    module.cert-manager.ready
  ]
}


module "route53" {
  source       = "./modules/route53"
  dns          = var.dns
  external_dns = module.gitpod.external_dns
}
