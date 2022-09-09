module "k3s" {
  source = "../../modules/k3s"

  name             = var.name
  gcp_project      = var.project
  gcp_region       = var.region
  gcp_zone         = var.zone
  credentials      = var.credentials
  kubeconfig       = var.kubeconfig
  dns_sa_creds     = var.credentials
  dns_project      = var.project
  managed_dns_zone = var.managed_dns_zone
  domain_name      = var.domain_name
  cluster_version  = var.cluster_version
  image_id         = var.image_id
}
