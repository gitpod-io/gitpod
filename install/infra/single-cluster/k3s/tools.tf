module "certmanager" {
  source = "../../modules/tools/cert-manager"

  kubeconfig  = var.kubeconfig
}

module "cluster-issuer" {
  source              = "../../modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  gcp_credentials     = local.credentials
  issuer_name         = "cloudDNS"
  cert_manager_issuer = {
    project                 = var.project
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}
