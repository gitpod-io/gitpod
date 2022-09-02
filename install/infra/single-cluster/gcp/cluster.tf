module "gke" {
  source = "../../modules/gke"

  cluster_name    = var.cluster_name
  kubeconfig      = var.kubeconfig
  cluster_version = var.cluster_version
  project         = var.project
  region          = var.region
  zone            = var.zone

  domain_name = var.domain_name
  enable_external_database = var.enable_external_database
  enable_external_storage  = var.enable_external_storage
  enable_external_registry = var.enable_external_registry
}
