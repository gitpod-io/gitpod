module "eks" {
  source                   = "../../modules/eks"
  domain_name              = var.domain_name
  cluster_name             = var.cluster_name
  region                   = var.region
  vpc_cidr                 = var.vpc_cidr
  vpc_availability_zones   = var.vpc_availability_zones
  image_id                 = var.image_id
  cluster_version          = var.cluster_version
  kubeconfig               = var.kubeconfig
  create_external_database = var.create_external_database
  create_external_storage  = var.create_external_storage
  service_machine_type     = "m6i.xlarge"
  workspace_machine_type   = "m6i.2xlarge"

  create_external_storage_for_registry_backend = var.create_external_storage_for_registry_backend
}
