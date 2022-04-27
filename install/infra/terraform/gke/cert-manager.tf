# provider "helm" {
#   kubernetes {
#     host                   = google_container_cluster.gitpod-cluster.endpoint
#     # client_key             = base64decode(google_container_cluster.gitpod-cluster.master_auth.0.client_key)
#     # client_certificate     = base64decode(google_container_cluster.gitpod-cluster.master_auth.0.client_certificate)
#     token                  = module.gke_auth.token
#     cluster_ca_certificate = base64decode(google_container_cluster.gitpod-cluster.master_auth.0.cluster_ca_certificate)
#   }
# }

# resource "helm_release" "cm" {
#   name             = "cert-manager"
#   namespace        = "cert-manager"
#   create_namespace = true
#   chart            = "cert-manager"
#   repository       = "https://charts.jetstack.io"
#   version          = "v1.8.0"
# }
