variable "kubeconfig" {}
variable "sub_domain" {
    default = "nightly"
}
variable "project" {
    default = "sh-automated-tests"
}
variable "sa_creds" {}
variable "dns_sa_creds" {}

terraform {
  backend "gcs" {
    bucket      = "nightly-tests"
    prefix      = "tf-state"
  }
}

module "k3s" {
    source      = "github.com/gitpod-io/gitpod//install/infra/terraform/k3s?ref=nvn-infra-tf" # we can later use tags here

    gcp_project = var.project
    credentials = var.sa_creds
    kubeconfig  = var.kubeconfig
}

// this module is intended to be run separately from the above two. so a separate target for apply is necessary
module "tools" {
    source          = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cm-cloud-dns?ref=nvn-infra-tf" # we can later use tags here

    kubeconfig      = var.kubeconfig
    credentials     = var.dns_sa_creds
    gcp_sub_domain  = var.sub_domain
}
