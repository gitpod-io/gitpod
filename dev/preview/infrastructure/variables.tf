variable "infra_provider" {
  type        = string
  default     = "harvester"
  description = "the provider for the infra: [harvester, gce]"
}

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

variable "vm_type" {
  type    = string
  default = "n2-standard-8"
}

variable "vm_image" {
  type        = string
  description = "The VM image"
  default     = "gitpod-k3s-202209251218"
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
  default     = false
  description = "Flag to decide whether to use spot instances"
}
