// Common variables
variable "kubeconfig" {
    default = "./kubeconfig"

}
variable "dns_enabled" {}
variable "domain_name" {}
variable "enable_airgapped" {}
variable "enable_external_database" {}
variable "enable_external_registry" {}
variable "enable_external_storage" {}
variable "workspace_name" {
}

// Azure-specific variables
variable "location" {
    default = "northeurope"

}
