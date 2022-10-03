terraform {
  required_providers {
    aws = {
      version = " ~> 3.0"
      source  = "registry.terraform.io/hashicorp/aws"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.5.1"
    }
  }
}

provider "aws" {
  region = var.region
}
