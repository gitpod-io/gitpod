terraform {
  backend "s3" {
    bucket = "nan-tf-bucket"
    key    = "aws/terraform.state"
  }
}
