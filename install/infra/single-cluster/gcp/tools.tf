module "certmanager" {
  source = "../../modules/tools/cert-manager"

  kubeconfig  = var.kubeconfig
  credentials = var.credentials
}

module "externaldns" {
  source      = "../../modules/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = var.credentials
  project     = var.project
  region      = var.region
  zone        = var.zone
}

module "cluster-issuer" {
  source              = "../../modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  issuer_name         = "cloudDNS"
  cert_manager_issuer = {
    project                 = var.project
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}
