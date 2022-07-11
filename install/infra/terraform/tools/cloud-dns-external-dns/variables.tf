variable "kubeconfig" {
    description = "Path to the KUBECONFIG file to connect to the cluster"
    default = "./kubeconfig"
}

variable "gcp_project" {
    description = "Google cloud Region to perform operations in"
    default = "dns-for-playgrounds"
}

variable "gcp_region" {
    description = "Google cloud Region to perform operations in"
    default = "europe-west1"
}

variable "gcp_zone" {
    description = "Google cloud Zone to perform operations in"
    default = "europe-west1-d"
}

variable "credentials" {
    description = "Path to the JSON file storing Google service account credentials"
}

variable "txt_owner_id" {
    description = "A unique value for the external-dns setup"
    default = "gitpod"
}
