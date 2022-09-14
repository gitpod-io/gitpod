variable "project" {
  description = "GCP project to create the resources in"
}

variable "cluster_name" {
  type        = string
  description = "GKE cluster name."
}
variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file to write the KUBECONFIG output in"
  default     = "kubeconfig"
}

variable "region" {
  type        = string
  description = "Region to create the resources in"
  default     = "europe-west1"
}

variable "zone" {
  type        = string
  description = "Zones under the provided region, if left empty a regional cluster will be created"
  default     = "europe-west1-b"
}

variable "domain_name" {
  description = "Domain name to associate with the Gitpod installation"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to create the cluster with"
  default     = "1.22"
}

variable "enable_external_database" {
  default     = true
  description = "Create an external Cloud DNS instance for Gitpod"
}

variable "enable_external_storage" {
  default     = true
  description = "Create a GCS bucket for Gitpod object storage"
}

variable "enable_external_registry" {
  default     = true
  description = "Create a Google Container Registry for Gitpod workspace images"
}
