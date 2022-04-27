terraform {
  required_version = ">= 1.1.0"
}

# Remote state
terraform {
  backend "gcs" {
    bucket      = "gitpod-tf"
    prefix      = "terraform/state"
  }
}
