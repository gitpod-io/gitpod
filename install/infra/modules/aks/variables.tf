// Common variables
variable "kubeconfig" {
  default = "./kubeconfig"
}

variable "cluster_version" {
  description = "kubernetes version of to create the cluster with"
}

variable "dns_enabled" {}
variable "domain_name" {}
variable "enable_airgapped" {}
variable "enable_external_database" {}
variable "enable_external_registry" {}
variable "enable_external_storage" {}
variable "workspace_name" {
}

// Azure-specific variables
variable "location" {
  default = "northeurope"
}
