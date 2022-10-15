variable "nameservers" {}
variable "domain_name" {}
variable "managed_dns_zone" {}
variable "dns_project" {}
variable "credentials" {}

provider "google" {
  alias       = "dns"
  project     = "dns-for-playgrounds"
  credentials = var.credentials
}

resource "google_dns_record_set" "gitpod-dns-3" {
  provider     = google.dns
  name         = "${var.domain_name}."
  managed_zone = var.managed_dns_zone
  project      = var.dns_project
  type         = "NS"
  ttl          = 5

  rrdatas = var.nameservers
}
