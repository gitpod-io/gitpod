variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "harvester_kube_path" {
  type        = string
  description = "The path to the Harvester Cluster kubeconfig"
  #  default     = "~/.kube/harvester"
}

variable "dev_kube_path" {
  type        = string
  description = "The path to the Dev Cluster kubeconfig"
  #  default     = "~/.kube/dev"
}

variable "vm_memory" {
  type        = string
  default     = "2Gi"
  description = "Memory for the VM"
}

variable "vm_cpu" {
  type        = number
  default     = 2
  description = "CPU for the VM"
}

variable "vm_storage_class" {
  type        = string
  default     = "longhorn-gitpod-k3s-202209251218-onereplica"
  description = "The storage class for the VM"
}
