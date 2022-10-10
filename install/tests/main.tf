variable "kubeconfig" {}
variable "TEST_ID" { default = "nightly" }

# We store the state always in a GCS bucket
terraform {
  backend "gcs" {
    bucket = "nightly-tests"
    prefix = "tf-state"
  }
}

variable "project" { default = "sh-automated-tests" }
variable "sa_creds" { default = null }
variable "dns_sa_creds" { default = null }

data "local_file" "dns_credentials" {
  filename = var.dns_sa_creds
}

data "local_file" "sa_credentials" {
  filename = var.sa_creds
}

variable "eks_node_image_id" {
  default = null
}

variable "domain" { default = "tests.gitpod-self-hosted.com" }
variable "gcp_zone" { default = "tests-gitpod-self-hosted-com" }

variable "k3s_node_image_id" {
  default = null
}

variable "cluster_version" {
  default = "1.22"
}

module "gke" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/gke?ref=main" # we can later use tags here
  source = "../infra/modules/gke" # we can later use tags here

  cluster_name    = "gp-${var.TEST_ID}"
  project         = var.project
  kubeconfig      = var.kubeconfig
  region          = "europe-west1"
  zone            = "europe-west1-d"
  cluster_version = var.cluster_version
  domain_name     = "${var.TEST_ID}.${var.domain}"
}

module "k3s" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/k3s?ref=main" # we can later use tags here
  source = "../infra/modules/k3s" # we can later use tags here

  name            = var.TEST_ID
  gcp_project     = var.project
  credentials     = var.sa_creds
  kubeconfig      = var.kubeconfig
  domain_name     = "${var.TEST_ID}.${var.domain}"
  cluster_version = var.cluster_version
  image_id        = var.k3s_node_image_id
}

module "gcp-issuer" {
  source          = "../infra/modules/tools/issuer"
  kubeconfig      = var.kubeconfig
  gcp_credentials = data.local_file.sa_credentials.content
  issuer_name     = "cloudDNS"
  cert_manager_issuer = {
    project = var.project
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key  = "keys.json"
    }
  }
}

module "aks" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/aks?ref=main" # we can later use tags here
  source = "../infra/modules/aks"

  domain_name              = "${var.TEST_ID}.${var.domain}"
  enable_airgapped         = false
  create_external_database = true
  create_external_registry = true
  create_external_storage  = true
  resource_group_name      = "p${var.TEST_ID}"
  kubeconfig               = var.kubeconfig
  cluster_version          = var.cluster_version
}

module "eks" {
  source                   = "../infra/modules/eks"
  domain_name              = "${var.TEST_ID}.${var.domain}"
  cluster_name             = var.TEST_ID
  region                   = "eu-west-1"
  vpc_availability_zones   = ["eu-west-1c", "eu-west-1b"]
  image_id                 = var.eks_node_image_id
  kubeconfig               = var.kubeconfig
  cluster_version          = var.cluster_version
  create_external_registry = true
  create_external_database = true
  create_external_storage  = true
  # we test against a separate bucket for registry backend
  create_external_storage_for_registry_backend = true
}

module "certmanager" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cert-manager?ref=main"
  source = "../infra/modules/tools/cert-manager"

  kubeconfig = var.kubeconfig
}

module "clouddns-externaldns" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/external-dns?ref=main"
  source      = "../infra/modules/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = data.local_file.sa_credentials.content
  project     = var.project
}

module "azure-externaldns" {
  source       = "../infra/modules/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.aks.external_dns_settings
  domain_name  = "${var.TEST_ID}.${var.domain}"
  txt_owner_id = var.TEST_ID
}

module "aws-externaldns" {
  source       = "../infra/modules/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.eks.external_dns_settings
  domain_name  = "${var.TEST_ID}.${var.domain}"
  txt_owner_id = var.TEST_ID
}

module "azure-issuer" {
  source              = "../infra/modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.aks.cert_manager_issuer
  issuer_name         = "azureDNS"
}

module "aws-issuer" {
  source              = "../infra/modules/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.eks.cert_manager_issuer
  secretAccessKey     = module.eks.secretAccessKey
  issuer_name         = "route53"
}

module "k3s-add-dns-record" {
  source           = "../infra/modules/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.k3s.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = "${var.TEST_ID}.${var.domain}"
}

module "gcp-add-dns-record" {
  source           = "../infra/modules/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.gke.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = "${var.TEST_ID}.${var.domain}"
}

module "azure-add-dns-record" {
  source           = "../infra/modules/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.aks.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = "${var.TEST_ID}.${var.domain}"
}

module "aws-add-dns-record" {
  source           = "../infra/modules/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.eks.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = "${var.TEST_ID}.${var.domain}"
}
