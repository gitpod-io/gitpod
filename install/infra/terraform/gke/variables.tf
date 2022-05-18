variable "project" {
  type        = string
  description = "The project ID to create the cluster."
}

variable "kubeconfig" {
  type = string
  description = "Path to write the kubeconfig output to"
  default = "./kubeconfig"
}

variable "credentials" {
  type        = string
  description = "Path to the json file storing SA credentials."
}

variable "region" {
  type        = string
  description = "The region to create the cluster."
  default     = "europe-west1"
}

variable "zone" {
  type        = string
  description = "The zone to create the cluster."
  default     = "b"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version to be setup"
  default     = "1.21.11-gke.1100"
}

variable "name" {
  type        = string
  description = "The name of the cluster."
  default     = "sh-test"
}

variable "machine_type" {
  type        = string
  description = "Type of the node compute engines."
  default     = "n2d-standard-4"
}

variable "min_count" {
  type        = number
  description = "Minimum number of nodes in the NodePool. Must be >=0 and <= max_node_count."
  default     = 1
}

variable "max_count" {
  type        = number
  description = "Maximum number of nodes in the NodePool. Must be >= min_node_count."
  default     = 50
}

variable "disk_size_gb" {
  type        = number
  description = "Size of the node's disk."
  default = 100
}

variable "initial_node_count" {
  type        = number
  description = "The number of nodes to create in this cluster's default node pool."
  default     = 1
}

variable "env_name" {
  description = "The environment for the GKE cluster"
  default     = "test"
}

variable "network" {
  description = "The VPC network created to host the cluster in"
  default     = "gitpod-gke-network"
}

variable "subnetwork" {
  description = "The subnetwork created to host the cluster in"
  default     = "gitpod-gke-subnet"
}

variable "ip_range_pods_name" {
  description = "The secondary ip range to use for pods"
  default     = "gitpod-ip-range-pods"
}

variable "ip_range_services_name" {
  description = "The secondary ip range to use for services"
  default     = "gitpod-ip-range-services"
}

variable "pre-emptible" {
  type = bool
  description = "Set if the nodes are to be pre-emptible"
  default     = false
}
