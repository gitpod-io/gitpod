variable "gcp_zone" { default = "sh-tests-gitpod-self-hosted-com" }

module "add-dns-record" {
  source = "../../modules/tools/cloud-dns-ns"

  nameservers      = module.${cluster}.name_servers
  dns_project      = "sh-automated-tests"
  managed_dns_zone = var.gcp_zone
  domain_name      = var.domain_name
}
