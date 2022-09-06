variable "resource_group_name" {
  type        = string
  description = "AKS resource group name to be created, all the resources created under will use this as prefix in their naming"
}

variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file to write the KUBECONFIG output in"
  default     = "kubeconfig"
}

variable "location" {
  type        = string
  description = "Location to create the resource group in"
  default     = "northeurope"
}

variable "domain_name" {
  description = "Domain name to associate with the Gitpod installation, provide empty string to avoid creating Azure DNS zone"
}

variable "create_external_database" {
  default     = true
  description = "Create a Azure mysql Database"
}

variable "create_external_storage" {
  default     = true
  description = "Create an Azure Blob Storage"
}

variable "create_external_registry" {
  default     = false
  description = "Create an Azure Container Registry"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to create the cluster with"
  default     = "1.22"
}
