module "gke" {
  source = "../../modules/gke"

  credentials     = var.credentials
  name            = var.cluster_name
  kubeconfig      = var.kubeconfig
  cluster_version = var.cluster_version
  project         = var.project
  region          = var.region
  zone            = var.zone

  domain_name     = var.domain_name
}
