module "cert" {
  source = "./cert"
  
  # The project the DNS zone lives in
  project = "gitpod-dev"
  region  = "europe-west-3"

  dns_zone_domain = var.dns_zone_domain
  domain = var.domain
  subdomains = var.subdomains
  public_ip = "34.76.116.244"
  
  cert_name = var.namespace
  cert_namespace = "certs"
}

# https://www.terraform.io/docs/providers/google/guides/provider_reference.html
provider "google" {
  project = "gitpod-dev"
  region  = "europe-west-3"
  # Relies on GOOGLE_APPLICATION_CREDENTIALS pointing to the service account file
}

# https://gavinbunney.github.io/terraform-provider-kubectl/docs/provider.html
provider "kubectl" {
  load_config_file       = true
}

# The kubernetes backend is brand new (https://github.com/hashicorp/terraform/issues/19525, got released with 0.13.0 7 days ago) and
# seems to have issues with the GCP Application Default Credentials.
# https://www.terraform.io/docs/backends/types/kubernetes.html
# terraform {
#     backend "kubernetes" {
#         # We want to store .tfstate in a separate secret per branch. Since terraform does not allow this we use g'old envsubst :-|
#         secret_suffix    = "${NAMESPACE}"
#         namespace = "certs"
#         load_config_file = true
#     }
# }