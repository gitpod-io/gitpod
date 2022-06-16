variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
}
variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file"
  default     = "kubeconfig"
}
variable "main_network_block" {
  type        = string
  description = "Base CIDR block to be used in our VPC."
  default     = "10.0.0.0/16"
}
variable "subnet_prefix_extension" {
  type        = number
  description = "CIDR block bits extension to calculate CIDR blocks of each subnetwork."
  default     = 8
}
variable "zone_offset" {
  type        = number
  description = "CIDR block bits extension offset to calculate Public subnets, avoiding collisions with Private subnets."
  default     = 21
}
