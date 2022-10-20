module "certmanager" {
  source = "../../modules/tools/cert-manager"

  kubeconfig = var.kubeconfig
}

module "externaldns" {
  source      = "../../modules/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = module.gke.dns_credentials
  project     = var.project
}

module "cluster-issuer" {
  source          = "../../modules/tools/issuer"
  kubeconfig      = var.kubeconfig
  gcp_credentials = module.gke.dns_credentials
  issuer_name     = "cloudDNS"
  cert_manager_issuer = {
    project = var.project
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}
