locals {
  dns_list = var.domain_name == "" ? [] : toset([
    "${var.domain_name}.",
    "*.${var.domain_name}.",
    "ws.${var.domain_name}.",
    "*.ws.${var.domain_name}."
  ])
}
