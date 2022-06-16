variable "kubeconfig" { }
variable "TEST_ID" { default = "nightly" }

variable "k8s_flavor" { default = "gke" }

# We store the state always in a GCS bucket
terraform {
  backend "gcs" {
    bucket = "nightly-tests"
    prefix = "tf-state"
  }
}

variable "project" { default = "sh-automated-tests" }
variable "sa_creds" { default = null }
variable "dns_sa_creds" {default = null }

module "gke" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/gke?ref=main" # we can later use tags here
  source = "../infra/terraform/gke" # we can later use tags here

  name        = var.TEST_ID
  project     = var.project
  credentials = var.sa_creds
  kubeconfig  = var.kubeconfig
  region      = "europe-west1"
  zone        = "europe-west1-d"
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

module "aks" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/aks?ref=main" # we can later use tags here
  source = "../infra/terraform/aks"

  domain_name              = "${var.TEST_ID}.gitpod-self-hosted.com"
  enable_airgapped         = false
  enable_external_database = true
  enable_external_registry = true
  enable_external_storage  = true
  dns_enabled              = true
  workspace_name           = var.TEST_ID
}

module "eks" {
  source = "../infra/terraform/eks"
  cluster_name = var.TEST_ID
  kubeconfig   = var.kubeconfig
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

module "azure-externaldns" {
  source = "../infra/terraform/tools/azure-external-dns"
  kubeconfig     = var.kubeconfig
  settings = module.aks.external_dns_settings
  domain_name = "${var.TEST_ID}.gitpod-self-hosted.com"
  txt_owner_id   = var.TEST_ID
}

module "azure-issuer" {
  source = "../infra/terraform/tools/issuer/azure"
  kubeconfig  = var.kubeconfig
  cert_manager_issuer = module.aks.cert_manager_issuer
}

module "add_gcp_nameservers" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cloud-dns-ns?ref=main"
  source           = "../infra/terraform/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.aks.domain_nameservers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = "gitpod-self-hosted-com"
  domain_name      = "${var.TEST_ID}.gitpod-self-hosted.com"
}
