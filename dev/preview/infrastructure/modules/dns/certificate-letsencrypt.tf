locals {
  letsencrypt_enabled = var.cert_issuer == "letsencrypt-issuer-gitpod-core-dev"
}

resource "tls_private_key" "letsencrypt" {
  count = local.letsencrypt_enabled ? 1 : 0

  algorithm = "RSA"
}

resource "acme_registration" "letsencrypt" {
  provider = acme.letsencrypt
  count    = local.letsencrypt_enabled ? 1 : 0

  account_key_pem = tls_private_key.letsencrypt[0].private_key_pem
  email_address   = "preview-environment-certificate-throwaway@gitpod.io"
}

resource "acme_certificate" "letsencrypt" {
  provider = acme.letsencrypt
  count    = local.letsencrypt_enabled ? 1 : 0

  account_key_pem = acme_registration.letsencrypt[0].account_key_pem
  common_name     = "${var.preview_name}.${local.non_fully_qualified_dns_name}"
  subject_alternative_names = [
    "*.${var.preview_name}.${local.non_fully_qualified_dns_name}",
    "*.ws-dev.${var.preview_name}.${local.non_fully_qualified_dns_name}"
  ]
  preferred_chain = "ISRG Root X1"

  dns_challenge {
    provider = "gcloud"
    config = {
      GCE_PROJECT = var.gcp_project_dns
    }
  }
}


resource "google_secret_manager_secret" "letsencrypt" {
  count = local.letsencrypt_enabled ? 1 : 0

  secret_id = "certificate-${var.preview_name}"

  labels = {
    label = "preview-certificate"
  }

  replication {
    auto {}
  }
}


resource "google_secret_manager_secret_version" "letsencrypt" {
  count = local.letsencrypt_enabled ? 1 : 0

  secret = google_secret_manager_secret.letsencrypt[0].id

  secret_data = jsonencode({
    "tls.crt" = base64encode("${lookup(acme_certificate.letsencrypt[0], "certificate_pem")}${lookup(acme_certificate.letsencrypt[0], "issuer_pem")}")
    "tls.key" = base64encode("${lookup(acme_certificate.letsencrypt[0], "private_key_pem")}")
  })

  depends_on = [
    acme_certificate.letsencrypt[0]
  ]
}
