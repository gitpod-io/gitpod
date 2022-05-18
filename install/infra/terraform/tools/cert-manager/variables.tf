variable "kubeconfig" {
    description = "Path to the KUBECONFIG file to connect to the cluster"
    default = "./kubeconfig"
}

variable "credentials" {
    description = "Path to the JSON file storing Google SA keyfile to grant access to managed DNS usage(do not provide if not using managed DNS)"
    default     = null
}
