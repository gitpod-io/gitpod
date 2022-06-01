provider "kubernetes" {
  config_path = var.kubeconfig
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
        "solvers" = [
          {
            "dns01" = {
              "azureDNS" = var.cert_manager_issuer
            }
          }
        ]
      }
    }
  }
}
