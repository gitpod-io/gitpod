terraform {
  backend "s3" {
    bucket = "gitpod-tf"
    key    = "aws/terraform.state"
  }
}
