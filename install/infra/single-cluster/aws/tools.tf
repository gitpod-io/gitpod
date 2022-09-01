module "certmanager" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cert-manager?ref=main"
  source = "../../modules/tools/cert-manager"

  kubeconfig = var.kubeconfig
}

module "externaldns" {
  source       = "../../modules/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.eks.external_dns_settings
  domain_name  = var.domain_name
  txt_owner_id = var.cluster_name
}

module "cluster-issuer" {
  source              = "../../modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.eks.cert_manager_issuer
  secretAccessKey     = module.eks.secretAccessKey
  issuer_name         = "route53"
}

module "cluster-autoscaler" {
  source            = "../../modules/tools/aws-cluster-autoscaler"
  kubeconfig        = var.kubeconfig
  region            = var.region
  cluster_name      = var.cluster_name
  cluster_id        = module.eks.cluster_id
  oidc_provider_arn = module.eks.oidc_provider_arn
}
