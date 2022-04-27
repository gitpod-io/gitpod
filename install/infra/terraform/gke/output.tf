# output "cluster_name" {
#   description = "Cluster name"
#   value       = google_container_cluster.gitpod-cluster.name
# }

# output "client_certificate" {
#   value     = google_container_cluster.gitpod-cluster.master_auth.0.client_certificate
#   sensitive = true
# }

# output "client_key" {
#   value     = google_container_cluster.gitpod-cluster.master_auth.0.client_key
#   sensitive = true
# }

# output "cluster_ca_certificate" {
#   value     = google_container_cluster.gitpod-cluster.master_auth.0.cluster_ca_certificate
#   sensitive = true
# }

# output "host" {
#   value     = google_container_cluster.gitpod-cluster.endpoint
#   sensitive = true
# }
output "kubernetes_endpoint" {
  sensitive = true
  value     = module.gke_auth.host
}

output "client_token" {
  sensitive = true
  value     = module.gke_auth.token
}

output "ca_certificate" {
  sensitive = true
  value = module.gke_auth.cluster_ca_certificate
}

output "kubeconfig_raw" {
  sensitive = true
  value = module.gke_auth.kubeconfig_raw
}

