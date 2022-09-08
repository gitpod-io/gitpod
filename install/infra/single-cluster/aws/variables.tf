variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
}
variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file to write the KUBECONFIG output in"
  default     = "kubeconfig"
}

variable "image_id" {
  type        = string
  description = "AMI Image ID specific to the region, refer https://cloud-images.ubuntu.com/docs/aws/eks/"
}

variable "region" {
  type        = string
  description = "Region to create the resources in"
  default     = "eu-west-1"
}

variable "vpc_availability_zones" {
  type        = list(string)
  description = "Availibiliy zones under the provided region, should be atleast two"
  default     = ["eu-west-1c", "eu-west-1b"]
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block IP to create the VPC. The CIDR will be divided into 5 subnets"
  default     = "10.100.0.0/16"
}

variable "domain_name" {
  description = "Domain name to associate with the Gitpod installation, provide empty string to avoid creating route53 zone"
}

variable "create_external_database" {
  default     = true
  description = "Create a mysql RDS database"
}

variable "create_external_storage" {
  default     = true
  description = "Create an S3 bucket"
}

variable "create_external_storage_for_registry_backend" {
  default     = false
  description = "Create an S3 bucket for registry backend"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to create the cluster with"
  default     = "1.22"
}
