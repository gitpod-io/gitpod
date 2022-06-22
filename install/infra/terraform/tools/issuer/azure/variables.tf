variable "kubeconfig" {
    description = "Path to the KUBECONFIG file to connect to the cluster"
    default = "./kubeconfig"
}

variable "issuer_name" {
    default = "azureDNS"
}

variable "cert_manager_issuer" {
    default     = null
}
