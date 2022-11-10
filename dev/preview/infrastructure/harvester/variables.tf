variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "kubeconfig_path" {
  type        = string
  default     = "/home/gitpod/.kube/config"
  description = "The path to the kubernetes config"
}

variable "harvester_kube_context" {
  type        = string
  default     = "harvester"
  description = "The name of the harvester kube context"
}

variable "dev_kube_context" {
  type        = string
  default     = "dev"
  description = "The name of the dev kube context"
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

variable "cert_issuer" {
  type        = string
  default     = "zerossl-issuer-gitpod-core-dev"
  description = "Certificate issuer"
}
