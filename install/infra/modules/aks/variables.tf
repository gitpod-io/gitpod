// Common variables
variable "kubeconfig" {
  description = "Path to write the kubeconfig output to"
  default = "./kubeconfig"
}

variable "cluster_version" {
  description = "The AKS Kubernetes version"
}

variable "domain_name" {
  description = "The domain name where Gitpod will create DNS records. Leave blank to disable DNS management."
  type = string
}

variable "enable_airgapped" {
  default = false
}

variable "create_external_database" {}
variable "create_external_registry" {}
variable "create_external_storage" {}

variable "resource_group_name" {
  description = "The resource group where Gitpod resources will be created."
  type = string
}

// Azure-specific variables
variable "location" {
  default = "northeurope"
}

variable "max_node_count_regular_workspaces" {
  type        = number
  description = "Maximum number of nodes in the regular workspaces NodePool. Must be >= 1."
  default     = 50
}

variable "max_node_count_headless_workspaces" {
  type        = number
  description = "Maximum number of nodes in the headless workspaces NodePool. Must be >= 1."
  default     = 50
}

variable "max_node_count_services" {
  type        = number
  description = "Maximum number of nodes in the services NodePool. Must be >= 1."
  default     = 4
}

variable "workspaces_machine_type" {
  type        = string
  description = "The regular and headless node machine type."
  default     = "Standard_D8_v4"
}

variable "services_machine_type" {
  type        = string
  description = "The services node machine type."
  default     = "Standard_D4_v4"
}
