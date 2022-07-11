variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
}
variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file"
  default     = "kubeconfig"
}

variable "image_id" {
  type = string
  description = "AMI Image ID specific to the region"
  // latest ubuntu image for 1.22 k8s for eu-west-1 region, refer https://cloud-images.ubuntu.com/docs/aws/eks/
  default = "ami-0793b4124359a6ad7"
}

variable "service_machine_type" {
  type = string
  description = "Machine type for service workload node pool"
  default = "m6i.xlarge"
}

variable "workspace_machine_type" {
  type = string
  description = "Machine type for workspace workload node pool"
  default = "m6i.2xlarge"
}

variable "region" {
  type = string
  default = "eu-west-1"
}

variable "vpc_availability_zones" {
  type = list(string)
  default = ["eu-west-1c", "eu-west-1b"]
}

variable "domain_name" {
}

variable "vpc_cidr" {
  default = "10.100.0.0/16"
}

variable "private_primary_subnet_cidr" {
  default = "10.100.160.0/19"
}

variable "private_secondary_subnet_cidr" {
  default = "10.100.128.0/19"
}

variable "public_primary_subnet_cidr" {
  default = "10.100.64.0/18"
}

variable "public_secondary_subnet_cidr" {
  default = "10.100.0.0/18"
}

variable "public_db_subnet_cidr_1" {
  default = "10.100.192.0/19"
}

variable "public_db_subnet_cidr_2" {
  default = "10.100.224.0/19"
}
