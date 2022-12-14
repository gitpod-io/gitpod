# resource "kubernetes_manifest" "cert" {
#   provider = k8s.dev
#   manifest = {
#     apiVersion = "cert-manager.io/v1"
#     kind       = "Certificate"

#     metadata = {
#       annotations = {
#         "preview/owner" = var.preview_name
#       }
#       name      = "harvester-${var.preview_name}"
#       namespace = "certs"
#     }

#     spec = {
#       dnsNames = [
#         "${var.preview_name}.preview.gitpod-dev.com",
#         "*.${var.preview_name}.preview.gitpod-dev.com",
#         "*.ws-dev.${var.preview_name}.preview.gitpod-dev.com"
#       ]
#       issuerRef = {
#         kind = "ClusterIssuer"
#         name = var.cert_issuer
#       }
#       renewBefore = "24h0m0s"
#       secretName  = "harvester-${var.preview_name}"
#     }
#   }
# }

data "kubernetes_secret" "zerossl_external_account_binding" {
  provider = k8s.dev
  metadata {
    name      = "zerossl-external-account-binding"
    namespace = "certmanager"
  }
}

data "kubernetes_secret" "zerossl_private_key" {
  provider = k8s.dev
  metadata {
    name      = "zerossl-private-key"
    namespace = "certmanager"
  }
}

data "kubernetes_secret" "letsencrypt_private_key" {
  provider = k8s.dev
  metadata {
    name      = "letsencrypt-private-key"
    namespace = "certmanager"
  }
}

# resource "acme_registration" "letsencrypt" {
#   provider = acme.letsencrypt
#   account_key_pem = lookup(data.kubernetes_secret.letsencrypt_private_key.data, "tls.key")
#   # TODO: "letsencrypt-throwaway@gitpod.io" was used for letsencrypt previously. Is is okay to just change the email?
#   email_address = "preview-environment-certificate-throwaway@gitpod.io"
# }

resource "acme_registration" "zerossl" {
  # provider = acme.zerossl
  account_key_pem = lookup(data.kubernetes_secret.zerossl_private_key.data, "tls.key")
  email_address   = "preview-environment-certificate-throwaway@gitpod.io"

  # kubectl --context=dev get clusterissuer zerossl-issuer-gitpod-core-dev -o yaml
  # kubectl --context=dev -n certmanager get secret zerossl-external-account-binding -o yaml
  external_account_binding {
    # TODO: It's currently present in zerossl-issuer-gitpod-core-dev but not in any secret we can read yet
    key_id      = "XXX"
    hmac_base64 = data.kubernetes_secret.zerossl_external_account_binding.data.secret
  }
}

resource "acme_certificate" "certificate" {
  # provider = acme.zerossl
  account_key_pem = acme_registration.zerossl.account_key_pem
  # TODO When using ${data.google_dns_managed_zone.preview-gitpod-dev.dns_name} below it complained about an ending "."
  common_name = "${var.preview_name}.preview.gitpod-dev.com"
  subject_alternative_names = [
    "*.${var.preview_name}.preview.gitpod-dev.com",
    "*.ws-dev.${var.preview_name}.preview.gitpod-dev.com"
  ]
  preferred_chain = "ISRG Root X1"

  dns_challenge {
    provider = "gcloud"
    config = {
      GCE_PROJECT = "gitpod-core-dev" # TODO: Don't hardcode
    }
  }
}

resource "kubernetes_secret" "certificate" {
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
    # lookup(acme_certificate.certificate, "certificate_pem")
    # lookup(acme_certificate.certificate, "issuer_pem")
    # lookup(acme_certificate.certificate, "private_key_pem")
    "tls.crt" = "${lookup(acme_certificate.certificate, "certificate_pem")}"
    "tls.key" = "${lookup(acme_certificate.certificate, "private_key_pem")}"
  }

  depends_on = [
    acme_certificate.certificate
  ]
}
