#
# Project
#
variable "project" {
  type    = string
}

#
# Region
#
variable "region" {
  type = string
}

#
# Certificate
#
variable "dns_zone_domain" {
  type = string
}

variable "domain" {
  type = string
}

variable "subdomains" {
  type = list(string)
}

variable "public_ip" {
  type = string
}

#
# Kubernetes name of the certificate
#
variable "cert_name" {
  type = string
}

#
# Kubernetes namespace to install the certificate to
#
variable "cert_namespace" {
  type = string
}
