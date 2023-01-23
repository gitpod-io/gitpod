variable "preview_name" {
  type        = string
  description = "name of the preview env"
}

variable "preview_ip" {
  type        = string
  description = "IP for the preview env: ingress in Harvester cluster, or machine ip"
}

variable "workspace_ip" {
  type        = string
  description = "IP for the workspace: LB in dev cluster for Harvester previews, or machine ip"
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
