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

variable "image_id" {
  description = "Node image ID to be used to provision EC2 instances"
  default     = "ubuntu-2004-focal-v20220419"
}

variable "cluster_version" {
  description = "Kubernetes version to use to provision the cluster"
  default     = "v1.22.12+k3s1"
}

variable "domain_name" {
  description = "Domain name to add to add DNS map to"
  default     = ""
}
