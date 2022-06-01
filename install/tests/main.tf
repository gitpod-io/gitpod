variable "kubeconfig" { }
variable "TEST_ID" { default = "nightly" }

# We store the state always in a GCS bucket
terraform {
  backend "gcs" {
    bucket = "nightly-tests"
    prefix = "tf-state"
  }
}

variable "project" { default = "sh-automated-tests" }
variable "sa_creds" { default = "" }
variable "dns_sa_creds" {default = "" }

module "gke" {
  source = "github.com/gitpod-io/gitpod//install/infra/terraform/gke?ref=nvn-infra-tf" # we can later use tags here

  name        = var.TEST_ID
  project     = var.project
  credentials = var.sa_creds
  kubeconfig  = var.kubeconfig
}

module "k3s" {
  source = "github.com/gitpod-io/gitpod//install/infra/terraform/k3s?ref=nvn-infra-tf" # we can later use tags here

  name        = var.TEST_ID
  gcp_project = var.project
  credentials = var.sa_creds
  kubeconfig  = var.kubeconfig
}

module "aks" {
  source = "github.com/gitpod-io/gitpod//install/infra/terraform/aks?ref=nvn-infra-aks" # we can later use tags here

  domain_name              = false
  enable_airgapped         = false
  enable_external_database = false
  enable_external_registry = false
  enable_external_storage  = false
  dns_enabled =  false
  name_format = join("-", [
    "gitpod",
    "%s", # region
    "%s", # name
    var.TEST_ID
  ])
  name_format_global = join("-", [
    "gitpod",
    "%s", # name
    var.TEST_ID
  ])
  workspace_name = var.TEST_ID
  labels = {
    "gitpod.io/workload_meta"               = true
    "gitpod.io/workload_ide"                = true
    "gitpod.io/workload_workspace_services" = true
    "gitpod.io/workload_workspace_regular"  = true
    "gitpod.io/workload_workspace_headless" = true
  }
}

// this module is intended to be run separately from the above two. so a separate target for apply is necessary
module "tools" {
  source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cm-cloud-dns?ref=nvn-infra-tf" # we can later use tags here

  kubeconfig     = var.kubeconfig
  credentials    = var.dns_sa_creds
  gcp_sub_domain = var.TEST_ID
}
