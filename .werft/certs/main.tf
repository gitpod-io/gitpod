module "cert" {
  source = "./cert"

  # The project the DNS zone lives in
  project = "gitpod-core-dev"
  region  = "europe-west-3"

  dns_zone_domain = var.dns_zone_domain
  domain = var.domain
  subdomains = var.subdomains
  public_ip = var.public_ip

  cert_name = var.namespace
  cert_namespace = var.cert_namespace
}

# https://www.terraform.io/docs/providers/google/guides/provider_reference.html
provider "google" {
  project = "gitpod-core-dev"
  region  = "europe-west-3"
  # Relies on GOOGLE_APPLICATION_CREDENTIALS pointing to the service account file
}

# https://gavinbunney.github.io/terraform-provider-kubectl/docs/provider.html
provider "kubectl" {
  load_config_file       = true
}
