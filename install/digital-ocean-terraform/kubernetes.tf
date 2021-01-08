resource "digitalocean_kubernetes_cluster" "gitpod_cluster" {
  name         = var.cluster_name
  region       = var.region
  auto_upgrade = true
  version      = data.digitalocean_kubernetes_versions.kubernetes_version.latest_version

  node_pool {
    name       = "default"
    size       = var.node_size
    node_count = var.node_count
  }
}
