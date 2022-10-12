variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "harvester_kube_path" {
  type        = string
  description = "The path to the Harvester Cluster kubeconfig"
}

variable "dev_kube_path" {
  type        = string
  description = "The path to the Dev Cluster kubeconfig"
}

variable "vm_memory" {
  type        = string
  default     = "12Gi"
  description = "Memory for the VM"
}

variable "vm_cpu" {
  type        = number
  default     = 6
  description = "CPU for the VM"
}

variable "vm_storage_class" {
  type        = string
  description = "The storage class for the VM"
  default     = "longhorn-gitpod-k3s-202209251218-onereplica"
}

variable "harvester_ingress_ip" {
  type        = string
  default     = "159.69.172.117"
  description = "Ingress IP in Harvester cluster"
}
