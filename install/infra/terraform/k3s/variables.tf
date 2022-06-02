variable "kubeconfig" {
  description = "The KUBECONFIG file path to store the resulting KUBECONFIG file to"
  default     = "./kubeconfig"
}

variable "gcp_project" {
  description = "Google cloud Region to perform operations in"
}

variable "gcp_region" {
  description = "Google cloud Region to perform operations in"
  default     = "europe-west1"
}

variable "gcp_zone" {
  description = "Google cloud Zone to perform operations in"
  default     = "europe-west1-b"
}

variable "credentials" {
  description = "Path to the JSON file storing Google service account credentials"
  default     = ""
}

variable "name" {
  description = "Prefix name for the nodes and firewall"
  default     = "k3s"
}

variable "dns_sa_creds" {
  description = "Credentials with DNS admin rights to the project with managed DNS record"
  default     = ""
}

variable "dns_project" {
  description = "Project associated with the dns maanged zone"
  default     = null
}

variable "domain_name" {
  description = "Domain name to add to add DNS map to"
  default     = null
}

variable "managed_dns_zone" {
  description = "Name of the managed DNS record"
  default     = null
}
