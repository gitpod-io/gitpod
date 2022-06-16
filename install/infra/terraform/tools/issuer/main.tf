provider "kubernetes" {
  config_path = var.kubeconfig
}

resource "kubernetes_secret" "dns_solver" {
  count    = var.secretAccessKey == null ? 0 : 1
  metadata {
    name      = "route53-credentials"
    namespace = "cert-manager"
  }
  data = {
    "secret-access-key" = var.secretAccessKey
  }
}


resource "kubernetes_manifest" "clusterissuer_gitpod" {
  manifest = {
    "apiVersion" = "cert-manager.io/v1"
    "kind" = "ClusterIssuer"
    "metadata" = {
      "name" = "gitpod-issuer"
    }
    "spec" = {
      "acme" = {
        "privateKeySecretRef" = {
          "name" = "issuer-account-key"
        }
        "server" = "https://acme-v02.api.letsencrypt.org/directory"
        # "server" = "https://acme-staging-v02.api.letsencrypt.org/directory"
        "solvers" = [
          {
            "dns01" = {
              "${var.issuer_name}" = "${var.cert_manager_issuer}"
            }
          }
        ]
      }
    }
  }
}
