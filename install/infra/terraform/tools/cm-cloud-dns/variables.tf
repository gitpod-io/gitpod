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
    default = "europe-west1-b"
}

variable "gcp_sub_domain" {
    description = "Sub domain under `gitpod-self-hosted.com` to be created"
}

variable "credentials" {
    description = "Path to the JSON file storing Google service account credentials"
}
