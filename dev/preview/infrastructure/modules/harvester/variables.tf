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

variable "preview_namespace" {
  type = string
}

variable "dev_kube_context" {
  type        = string
  default     = "dev"
  description = "The name of the dev kube context"
}

variable "ssh_key" {
  type        = string
  description = "ssh public key used for access to the vm"
}

variable "vm_image" {
  type        = string
  description = "The VM image"
  default     = "gitpod-k3s-202309220546"
}

variable "harvester_ingress_ip" {
  type        = string
  default     = "159.69.172.117"
  description = "Ingress IP in Harvester cluster"
}

variable "cert_issuer" {
  type        = string
  default     = "letsencrypt-issuer-gitpod-core-dev"
  description = "Certificate issuer"
}

variable "gcp_project_dns" {
  type        = string
  default     = "gitpod-core-dev"
  description = "The GCP project in which to create DNS records"
}

variable "with_large_vm" {
  type        = bool
  default     = false
  description = "Flag to decide whether to use a larger VM"
}
