variable "kubeconfig" {
  description = "Path to the KUBECONFIG file to connect to the cluster"
  default     = "./kubeconfig"
}

variable "region" {}
variable "cluster_name" {}
variable "cluster_id" {}
variable "oidc_provider_arn" {}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

module "cluster_autoscaler_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 4.12"

  role_name_prefix                 = "cluster-autoscaler"
  attach_cluster_autoscaler_policy = true
  cluster_autoscaler_cluster_ids   = [var.cluster_id]

  oidc_providers = {
    ex = {
      provider_arn               = var.oidc_provider_arn
      namespace_service_accounts = ["kube-system:cluster-autoscaler"]
    }
  }
}

# AWS cluster auto-scaler Deployment using Helm
resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = "9.20.1"
  namespace  = "kube-system"

  values = [
    jsonencode({
      cloudProvider = "aws"
      awsRegion     = var.region
      autoDiscovery = {
        clusterName = var.cluster_name
      }

      rbac = {
        serviceAccount = {
          name = "cluster-autoscaler"
          annotations = {
            "eks.amazonaws.com/role-arn" = module.cluster_autoscaler_irsa_role.iam_role_arn
          }
          create = true
        }
      }

      securityContext = {
        fsGroup = 65534
      }
      extraArgs = {
        skip-nodes-with-local-storage = false
        balance-similar-node-groups   = true
      }

    })
  ]

}
