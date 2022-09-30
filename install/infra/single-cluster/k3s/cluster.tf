module "k3s" {
  source = "../../modules/k3s"

  name             = var.name
  gcp_project      = var.project
  gcp_region       = var.region
  gcp_zone         = var.zone
  credentials      = var.credentials_path
  kubeconfig       = var.kubeconfig
  domain_name      = var.domain_name
  cluster_version  = var.cluster_version
  image_id         = var.image_id
}
