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

module "gcp-issuer" {
  source              = "../infra/terraform/tools/issuer"
  kubeconfig          = var.kubeconfig
  issuer_name         = "cloudDNS"
  cert_manager_issuer = {
    project  = "dns-for-playgrounds"
    serviceAccountSecretRef = {
      name = "clouddns-dns01-solver"
      key = "keys.json"
    }
  }
}


module "aks" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/aks?ref=main" # we can later use tags here
  source                   = "../infra/terraform/aks"

  domain_name              = "${var.TEST_ID}.gitpod-self-hosted.com"
  enable_airgapped         = false
  enable_external_database = true
  enable_external_registry = true
  enable_external_storage  = true
  dns_enabled              = true
  workspace_name           = var.TEST_ID
  kubeconfig               = var.kubeconfig
}

module "eks" {
  source                 = "../infra/terraform/eks"
  domain_name            = "${var.TEST_ID}.gitpod-self-hosted.com"
  cluster_name           = var.TEST_ID
  region                 = "eu-west-1"
  vpc_availability_zones = ["eu-west-1c", "eu-west-1b"]
  image_id               = "ami-0793b4124359a6ad7" // this AMI is regional
  kubeconfig             = var.kubeconfig
}

module "certmanager" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/cert-manager?ref=main"
  source      = "../infra/terraform/tools/cert-manager"

  kubeconfig  = var.kubeconfig
  credentials = var.dns_sa_creds
}

module "clouddns-externaldns" {
  # source = "github.com/gitpod-io/gitpod//install/infra/terraform/tools/external-dns?ref=main"
  source      = "../infra/terraform/tools/cloud-dns-external-dns"
  kubeconfig  = var.kubeconfig
  credentials = var.dns_sa_creds
}

module "azure-externaldns" {
  source       = "../infra/terraform/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.aks.external_dns_settings
  domain_name  = "${var.TEST_ID}.gitpod-self-hosted.com"
  txt_owner_id = var.TEST_ID
}

module "aws-externaldns" {
  source       = "../infra/terraform/tools/external-dns"
  kubeconfig   = var.kubeconfig
  settings     = module.eks.external_dns_settings
  domain_name  = "${var.TEST_ID}.gitpod-self-hosted.com"
  txt_owner_id = var.TEST_ID
}

module "azure-issuer" {
  source              = "../infra/terraform/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.aks.cert_manager_issuer
  issuer_name         = "azureDNS"
}

module "aws-issuer" {
  source              = "../infra/terraform/tools/issuer"
  kubeconfig          = var.kubeconfig
  cert_manager_issuer = module.eks.cert_manager_issuer
  secretAccessKey     = module.eks.secretAccessKey
  issuer_name         = "route53"
}

module "azure-add-dns-record" {
  source           = "../infra/terraform/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.aks.domain_nameservers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = "gitpod-self-hosted-com"
  domain_name      = "${var.TEST_ID}.gitpod-self-hosted.com"
}

module "aws-add-dns-record" {
  source           = "../infra/terraform/tools/cloud-dns-ns"
  credentials      = var.dns_sa_creds
  nameservers      = module.eks.domain_nameservers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = "gitpod-self-hosted-com"
  domain_name      = "${var.TEST_ID}.gitpod-self-hosted.com"
}
