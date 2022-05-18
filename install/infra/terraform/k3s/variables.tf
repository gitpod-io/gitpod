variable "kubeconfig" {
    description = "The KUBECONFIG file path to store the resulting KUBECONFIG file to"
    default = "./kubeconfig"
}

variable "gcp_project" {
    description = "Google cloud Region to perform operations in"
}

variable "gcp_region" {
    description = "Google cloud Region to perform operations in"
    default = "europe-west1"
}

variable "gcp_zone" {
    description = "Google cloud Zone to perform operations in"
    default = "europe-west1-b"
}

variable "credentials" {
    description = "Path to the JSON file storing Google service account credentials"
}
