module "kubernetes" {
  source             = "./modules/kubernetes"
  kubernetes_version = data.digitalocean_kubernetes_versions.kubernetes_version.latest_version
}
