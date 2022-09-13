variable "kubeconfig" {
    description = "Path to the KUBECONFIG file to connect to the cluster"
    default = "./kubeconfig"
}

variable "credentials" {
    description = "Google service account credentials"
}

variable "project" {
    description = "GCP project to associate with"
}

variable "txt_owner_id" {
    description = "A unique value for the external-dns setup"
    default = "gitpod"
}
