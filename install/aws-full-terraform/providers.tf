# https://www.terraform.io/docs/providers/aws/index.html
provider "aws" {
  profile = var.aws.profile
  region  = var.aws.region
}

# https://www.terraform.io/docs/providers/kubernetes/index.html
provider "kubernetes" {
  host                   = data.aws_eks_cluster.gitpod_cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.gitpod_cluster.certificate_authority.0.data)
  token                  = data.aws_eks_cluster_auth.default.token
  load_config_file       = false
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.gitpod_cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.gitpod_cluster.certificate_authority.0.data)
    token                  = data.aws_eks_cluster_auth.default.token
    load_config_file       = false
  }
}

provider "local" {}

provider "kubectl" {
  host                   = data.aws_eks_cluster.gitpod_cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.gitpod_cluster.certificate_authority.0.data)
  token                  = data.aws_eks_cluster_auth.default.token
  load_config_file       = false
}
