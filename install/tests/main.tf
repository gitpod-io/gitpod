variable "kubeconfig" {}
variable "TEST_ID" {
  default = "nightly"
}
variable "project" {
  default = "sh-automated-tests"
}
variable "sa_creds" {}
variable "dns_sa_creds" {}

terraform {
  backend "gcs" {
    bucket = "nightly-tests"
    prefix = "tf-state"
  }
}

module "gke" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/gke?ref=main" # we can later use tags here
  source = "../infra/terraform/gke" # we can later use tags here

  name        = var.TEST_ID
  project     = var.project
  credentials = var.sa_creds
  kubeconfig  = var.kubeconfig
  region      = "europe-west1"
  zone        = "europe-west1-b"
}

module "k3s" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/k3s?ref=main" # we can later use tags here
  source = "../infra/terraform/k3s" # we can later use tags here

  name             = var.TEST_ID
  gcp_project      = var.project
  credentials      = var.sa_creds
  kubeconfig       = var.kubeconfig
  dns_sa_creds     = var.dns_sa_creds
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = "gitpod-self-hosted-com"
  domain_name      = "${var.TEST_ID}.gitpod-self-hosted.com"
}

module "certmanager" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cert-manager?ref=main"
  source = "../infra/terraform/tools/cert-manager"

  kubeconfig     = var.kubeconfig
  credentials    = var.dns_sa_creds
}

module "externaldns" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/external-dns?ref=main"
  source = "../infra/terraform/tools/external-dns"

  kubeconfig     = var.kubeconfig
  credentials    = var.dns_sa_creds
}
