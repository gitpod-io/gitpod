variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "harvester_kube_path" {
  type        = string
  description = "The path to the Harvester Cluster kubeconfig"
  default     = "~/.kube/harvester"
}

variable "dev_kube_path" {
  type        = string
  description = "The path to the Dev Cluster kubeconfig"
  default     = "~/.kube/dev"
}
