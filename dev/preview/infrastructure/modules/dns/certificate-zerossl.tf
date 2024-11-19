locals {
  zerossl_enabled = var.cert_issuer == "zerossl-issuer-gitpod-core-dev"
}

data "google_secret_manager_secret_version" "zerossl_eab" {
  provider = google
  count    = local.zerossl_enabled ? 1 : 0

  secret = "zerossl-eab"
}

resource "tls_private_key" "zerossl" {
  count = local.zerossl_enabled ? 1 : 0

  algorithm = "RSA"
}

resource "acme_registration" "zerossl" {
  provider = acme.zerossl
  count    = local.zerossl_enabled ? 1 : 0

  account_key_pem = tls_private_key.zerossl[0].private_key_pem
  email_address   = "preview-environment-certificate-throwaway@gitpod.io"

  external_account_binding {
    key_id      = jsondecode(data.google_secret_manager_secret_version.zerossl_eab[0].secret_data).kid
    hmac_base64 = jsondecode(data.google_secret_manager_secret_version.zerossl_eab[0].secret_data).hmac
  }
}

resource "acme_certificate" "zerossl" {
  provider = acme.zerossl
  count    = local.zerossl_enabled ? 1 : 0

  account_key_pem = acme_registration.zerossl[0].account_key_pem
  common_name     = "${var.preview_name}.${local.non_fully_qualified_dns_name}"
  subject_alternative_names = [
    "*.${var.preview_name}.${local.non_fully_qualified_dns_name}",
    "*.ws-dev.${var.preview_name}.${local.non_fully_qualified_dns_name}"
  ]
  preferred_chain = ""

  dns_challenge {
    provider = "gcloud"
    config = {
      GCE_PROJECT = var.gcp_project_dns
    }
  }
}

resource "google_secret_manager_secret" "zerossl" {
  count     = local.zerossl_enabled ? 1 : 0
  secret_id = "certificate-${var.preview_name}"

  labels = {
    label = "preview-certificate"
  }

  replication {
    auto {}
  }
}
resource "google_secret_manager_secret_version" "zerossl" {
  count  = local.zerossl_enabled ? 1 : 0
  secret = google_secret_manager_secret.zerossl[0].id

  secret_data = jsonencode({
    "tls.crt" = base64encode("${lookup(acme_certificate.zerossl[0], "certificate_pem")}${lookup(acme_certificate.zerossl[0], "issuer_pem")}")
    "tls.key" = base64encode("${lookup(acme_certificate.zerossl[0], "private_key_pem")}")
  })

  depends_on = [
    acme_certificate.zerossl[0]
  ]
}
