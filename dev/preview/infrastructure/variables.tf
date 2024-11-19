variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "kubeconfig_path" {
  type        = string
  default     = "$HOME/.kube/config"
  description = "The path to the kubernetes config"
}

variable "dev_kube_context" {
  type        = string
  default     = "dev"
  description = "The name of the dev kube context"
}

variable "vm_type" {
  type    = string
  default = "n2d-standard-16"
}

variable "vm_image" {
  type        = string
  description = "The VM image"
  default     = "gitpod-k3s-202409020431"
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

variable "gce_use_spot" {
  type        = bool
  default     = true
  description = "Flag to decide whether to use spot instances"
}

variable "with_large_vm" {
  type        = bool
  default     = false
  description = "Flag to decide whether to use a larger VM"
}
