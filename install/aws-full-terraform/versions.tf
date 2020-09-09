terraform {
  backend "s3" {}
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "1.6.1"
    }
    helm = {
        source = "hashicorp/helm"
        version = ">= 1.3.0"
    }
  }
  required_version = ">= 0.13"
}
