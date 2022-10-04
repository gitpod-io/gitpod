variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to create the cluster with"
  default     = "1.22"
}

variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file"
  default     = "kubeconfig"
}
