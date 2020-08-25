terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    mysql = {
      source = "terraform-providers/mysql"
    }
  }
  required_version = ">= 0.13"
}
