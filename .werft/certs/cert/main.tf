
locals {
  # As we did create the zone and IP manually beforehand: have the zone name statically determined
  dns_zone_name  = replace(trimsuffix(var.dns_zone_domain, ".-"), ".", "-")

  cert_dns_names = [for subdomain in var.subdomains : "${subdomain}${var.domain}"]
}

#
# DNS records
#

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dns_record_set
resource "google_dns_record_set" "gitpod" {
  count        = length(var.subdomains)
  name         = "${var.subdomains[count.index]}${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = local.dns_zone_name
  rrdatas      = [var.public_ip]
  project      = var.project
}


#
# Certificate
# This part implicitly relies on certmanager being installed on the same cluster!
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "certificate" {
  template = file("${path.module}/templates/cert-manager_certificate.tpl")
  vars = {
    domain         = var.domain
    cert_dns_names = jsonencode(local.cert_dns_names)   # JSON arrays are also valid YAML arrays
    # To be able to cache the certificate between deployments (which purge the whole namespace) we keep them in a dedicated namespace
    cert_name      = var.cert_name
    cert_namespace = var.cert_namespace
  }
}

# https://gavinbunney.github.io/terraform-provider-kubectl/docs/kubectl_manifest
resource "kubectl_manifest" "cert_manager_certificate" {
  yaml_body = data.template_file.certificate.rendered
}



#
# End
#
resource "null_resource" "done" {
  depends_on = [
    google_dns_record_set.gitpod,
    kubectl_manifest.cert_manager_certificate
  ]
}
