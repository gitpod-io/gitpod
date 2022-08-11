variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version to create the cluster with"
  default     = "1.22"
}

variable "kubeconfig" {
  type        = string
  description = "Path to the kubeconfig file"
  default     = "kubeconfig"
}

variable "image_id" {
  type        = string
  description = "AMI Image ID specific to the region"
  // latest ubuntu image for 1.22 k8s for eu-west-1 region, refer https://cloud-images.ubuntu.com/docs/aws/eks/
  default = "ami-0793b4124359a6ad7"
}

variable "service_machine_type" {
  type        = string
  description = "Machine type for service workload node pool"
  default     = "m6i.xlarge"
}

variable "workspace_machine_type" {
  type        = string
  description = "Machine type for workspace workload node pool"
  default     = "m6i.2xlarge"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "vpc_availability_zones" {
  type    = list(string)
  default = ["eu-west-1c", "eu-west-1b"]
}

variable "domain_name" {
}

variable "vpc_cidr" {
  default = "10.100.0.0/16"
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

variable "create_external_registry" {
  default     = false
  description = "Create an EKS registry(Not officially supported)"
}
