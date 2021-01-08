# Configure the DigitalOcean Provider
provider "digitalocean" {}

provider "template" {}

provider "random" {}

provider "kubernetes" {
  load_config_file = false
  host             = digitalocean_kubernetes_cluster.gitpod_cluster.endpoint
  token            = digitalocean_kubernetes_cluster.gitpod_cluster.kube_config[0].token
  cluster_ca_certificate = base64decode(
    digitalocean_kubernetes_cluster.gitpod_cluster.kube_config[0].cluster_ca_certificate
  )
}

provider "helm" {
  kubernetes {
    load_config_file = false
    host             = digitalocean_kubernetes_cluster.gitpod_cluster.endpoint
    token            = digitalocean_kubernetes_cluster.gitpod_cluster.kube_config[0].token
    cluster_ca_certificate = base64decode(
      digitalocean_kubernetes_cluster.gitpod_cluster.kube_config[0].cluster_ca_certificate
    )
  }
}
