module "aks" {
#   source = "github.com/gitpod-io/gitpod//install/infra/modules/aks?ref=main"
  source = "../../modules/aks"

  domain_name              = var.domain_name
  create_external_database = var.create_external_database
  create_external_registry = var.create_external_registry
  create_external_storage  = var.create_external_storage
  resource_group_name      = var.resource_group_name
  kubeconfig               = var.kubeconfig
  cluster_version          = var.cluster_version
  location                 = var.location
}
