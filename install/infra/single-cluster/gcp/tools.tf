module "certmanager" {
  source = "../../modules/tools/cert-manager"

  kubeconfig  = var.kubeconfig
}

module "externaldns" {
  source      = "../../modules/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = module.gke.dns_credentials_path
  project     = var.project
  region      = var.region
  zone        = var.zone
}

module "cluster-issuer" {
  source              = "../../modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  gcp_credentials     = module.gke.dns_credentials_path
  issuer_name         = "cloudDNS"
  cert_manager_issuer = {
    project                 = var.project
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}
