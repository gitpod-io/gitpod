locals {
  zerossl_enabled = var.cert_issuer == "zerossl-issuer-gitpod-core-dev"
}

data "google_secret_manager_secret_version" "zerossl_eab" {
  secret = "zerossl-eab"
}

resource "tls_private_key" "zerossl" {
  count     = local.zerossl_enabled ? 1 : 0
  algorithm = "RSA"
}

resource "acme_registration" "zerossl" {
  count           = local.zerossl_enabled ? 1 : 0
  provider        = acme.zerossl
  account_key_pem = tls_private_key.zerossl[0].private_key_pem
  email_address   = "preview-environment-certificate-throwaway@gitpod.io"

  external_account_binding {
    key_id      = jsondecode(data.google_secret_manager_secret_version.zerossl_eab.secret_data).kid
    hmac_base64 = jsondecode(data.google_secret_manager_secret_version.zerossl_eab.secret_data).hmac
  }
}

resource "acme_certificate" "zerossl" {
  count           = local.zerossl_enabled ? 1 : 0
  provider        = acme.zerossl
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

resource "kubernetes_secret" "zerossl" {
  count    = local.zerossl_enabled ? 1 : 0
  provider = k8s.dev

  type = "kubernetes.io/tls"

  metadata {
    name      = "harvester-${var.preview_name}"
    namespace = "certs"
    annotations = {
      "preview/owner" = var.preview_name
    }
  }

  data = {
    "tls.crt" = "${lookup(acme_certificate.zerossl[0], "certificate_pem")}"
    "tls.key" = "${lookup(acme_certificate.zerossl[0], "private_key_pem")}"
  }

  depends_on = [
    acme_certificate.zerossl[0]
  ]
}
