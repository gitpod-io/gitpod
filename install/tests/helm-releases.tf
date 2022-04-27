provider "helm" {
  kubernetes {
    host                   = module.gke.kubernetes_endpoint
    # client_key             = base64decode(google_container_cluster.gitpod-cluster.master_auth.0.client_key)
    # client_certificate     = base64decode(google_container_cluster.gitpod-cluster.master_auth.0.client_certificate)
    token                  = module.gke.client_token
    cluster_ca_certificate = module.gke.ca_certificate
  }
}

# resource "helm_release" "cm" {
#   name             = "cert-manager"
#   namespace        = "cert-manager"
#   cleanup_on_fail  = true
#   create_namespace = true
#   chart            = "cert-manager"
#   repository       = "https://charts.jetstack.io"
#   version          = "v1.8.0"
# }
