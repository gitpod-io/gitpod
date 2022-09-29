variable "gcp_zone" { default = "${GCP_ZONE}" }
variable "dns_sa_creds" { }


module "add-dns-record" {
  source = "../../modules/tools/cloud-dns-ns"

  nameservers      = module.${cluster}.name_servers
  dns_project      = "dns-for-playgrounds"
  managed_dns_zone = var.gcp_zone
  domain_name      = var.domain_name
  credentials      = var.dns_sa_creds
}
