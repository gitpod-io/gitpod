variable "gcp_zone" { default = "${GCP_ZONE}" }
variable "dns_sa_creds" { }

provider "google" {
  alias       = "google-dns"
  project     = "dns-for-playgrounds"
  region      = var.region
  zone        = var.zone
  credentials = var.dns_sa_creds
}

module "add-dns-record" {
  source = "../../modules/tools/cloud-dns-ns"

  providers = {
    google = google.google-dns
  }

  nameservers      = module.${cluster}.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = var.domain_name
}
