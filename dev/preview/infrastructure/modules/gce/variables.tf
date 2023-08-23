variable "preview_name" {
  type        = string
  description = "The preview environment's name"
}

variable "kubeconfig_path" {
  type        = string
  default     = "~/.kube/config"
  description = "The path to the kubernetes config"
}

variable "preview_namespace" {
  type = string
}

variable "vm_type" {
  type    = string
  default = "n2d-standard-16"
}

variable "ssh_key" {
  type        = string
  description = "ssh public key used for access to the vm"
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

variable "harvester_ingress_ip" {
  type        = string
  default     = "159.69.172.117"
  description = "Ingress IP in Harvester cluster"
}

variable "vm_image" {
  type        = string
  description = "The VM image"
  default     = "gitpod-k3s-202308221555"
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

variable "use_spot" {
  type        = bool
  default     = true
  description = "Flag to decide whether to use spot instances"
}

variable "with_large_vm" {
  type        = bool
  default     = false
  description = "Flag to decide whether to use a larger VM"
}
