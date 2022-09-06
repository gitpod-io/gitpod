// Common variables
variable "kubeconfig" {
  default = "./kubeconfig"
}

variable "cluster_version" {
  description = "kubernetes version of to create the cluster with"
}

variable "domain_name" {}
variable "enable_airgapped" {
  default = false
}

variable "create_external_database" {}
variable "create_external_registry" {}
variable "create_external_storage" {}
variable "resource_group_name" {}

// Azure-specific variables
variable "location" {
  default = "northeurope"
}
