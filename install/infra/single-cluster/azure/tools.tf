module "certmanager" {
  # source = "github.com/gitpod-io/gitpod//install/infra/modules/tools/cert-manager?ref=main"
  source = "../../modules/tools/cert-manager"

  kubeconfig = var.kubeconfig
}

module "externaldns" {
  # source = "github.com/gitpod-io/gitpod//install/infra/modules/tools/externaldns?ref=main"
  source       = "../../modules/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.aks.external_dns_settings
  domain_name  = var.domain_name
  txt_owner_id = var.resource_group_name
}

module "cluster-issuer" {
  # source = "github.com/gitpod-io/gitpod//install/infra/modules/tools/issuer?ref=main"
  source              = "../../modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.aks.cert_manager_issuer
  issuer_name         = "azureDNS"
}
