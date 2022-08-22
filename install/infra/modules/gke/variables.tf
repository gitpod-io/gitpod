variable "project" {
  type        = string
  description = "The project ID to create the cluster."
}

variable "kubeconfig" {
  type        = string
  description = "Path to write the kubeconfig output to"
  default     = "./kubeconfig"
}

variable "region" {
  type        = string
  description = "The region to create the cluster."
}

variable "zone" {
  type        = string
  description = "The zone to create the cluster in. Eg: `europs-west1-b`. If not specified, A regional cluster(high-availability) will be created."
  default     = null
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to be setup"
  default     = "1.22.8-gke.201"
}

variable "cluster_name" {
  type        = string
  description = "The name of the cluster."
  default     = "gitpod"
}

variable "workspaces_machine_type" {
  type        = string
  description = "Type of the node compute engines for workspace nodepool."
  default     = "n2d-standard-8"
}

variable "services_machine_type" {
  type        = string
  description = "Type of the node compute engines for services nodepool."
  default     = "n2d-standard-4"
}

variable "max_node_count_workspaces" {
  type        = number
  description = "Maximum number of nodes in the workspaces NodePool. Must be >= 1."
  default     = 50
}

variable "max_node_count_services" {
  type        = number
  description = "Maximum number of nodes in the services NodePool. Must be >= 1."
  default     = 4
}

variable "disk_size_gb" {
  type        = number
  description = "Size of the node's disk."
  default     = 100
}

variable "credentials" {
  description = "Path to the JSON file storing Google service account credentials"
  default     = ""
}

variable "domain_name" {
  description = "Domain name register with Cloud DNS, leave empty if you want to manage it yourself"
  default     = null
}

variable "enable_external_database" {
  default     = true
  description = "Set this to false to avoid creating an RDS database to use with Gitpod instead of incluster mysql"
}

variable "enable_external_storage" {
  default     = true
  description = "Set this to false to avoid creating an s3 storage to use with Gitpod instead of incluster minio"
}

variable "enable_external_registry" {
  default     = true
  description = "Set this to false to create an AWS ECR registry to use with Gitpod(Not officially supported)"
}
