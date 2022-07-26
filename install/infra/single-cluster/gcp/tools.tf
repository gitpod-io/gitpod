module "certmanager" {
  source = "../../modules/tools/cert-manager"

  kubeconfig  = var.kubeconfig
  credentials = var.credentials
}

module "externaldns" {
  source      = "../../modules/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = var.credentials
  project     = "sh-automated-tests"
  region      = "europe-west1"
  zone        = "europe-west1-d"
}

module "cluster-issuer" {
  source      = "../../modules/tools/issuer"
  kubeconfig  = var.kubeconfig
  issuer_name = "cloudDNS"
  cert_manager_issuer = {
    project = "sh-automated-tests"
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}
