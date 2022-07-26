output "kubernetes_endpoint" {
  sensitive = true
  value     = module.gke_auth.host
}

output "name_servers" {
  value = google_dns_managed_zone.gitpod-dns-zone[0].name_servers
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
