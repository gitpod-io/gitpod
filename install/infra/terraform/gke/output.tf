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
  value     = module.gke_auth.cluster_ca_certificate
}

output "kubeconfig" {
  sensitive = true
  value     = module.gke_auth.kubeconfig_raw
}
