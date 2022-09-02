provider "kubernetes" {
  config_path = var.kubeconfig
}

resource "kubernetes_secret" "aws_dns_solver" {
  count = var.secretAccessKey == null ? 0 : 1
  metadata {
    name      = "route53-credentials"
    namespace = "cert-manager"
  }
  data = {
    "secret-access-key" = var.secretAccessKey
  }
}

# the following is only for GCP managed DNS setup

data local_file "gcp_credentials" {
  count    = var.gcp_credentials == null ? 0 : 1
  filename = var.gcp_credentials
}

resource "kubernetes_secret" "gcp_dns_solver" {
  count    = var.gcp_credentials == null ? 0 : 1
  depends_on = [
    data.local_file.gcp_credentials,
  ]
  metadata {
    name      = "clouddns-dns01-solver"
    namespace = "cert-manager"
  }
  data = {
    "keys.json" = "${data.local_file.gcp_credentials[0].content}"
  }
}


resource "kubernetes_manifest" "clusterissuer_gitpod" {
  manifest = {
    "apiVersion" = "cert-manager.io/v1"
    "kind"       = "ClusterIssuer"
    "metadata" = {
      "name" = var.cluster_issuer_name
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
