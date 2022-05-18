provider "kubernetes" {
  config_path = var.kubeconfig
}

data local_file "gcp_credentials" {
  filename = var.credentials
}

provider "google" {
  credentials = var.credentials
  project = var.gcp_project
  region  = var.gcp_region
  zone    = var.gcp_zone
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

#create namespace for external-dns
resource "kubernetes_namespace" "external_dns" {
  metadata {
    name = "external-dns"
  }
}

resource "kubernetes_secret" "external_dns" {
  depends_on = [
    kubernetes_namespace.external_dns
  ]
  metadata {
    name      = "external-dns"
    namespace = "external-dns"
  }
  data = {
    "credentials.json" = data.local_file.gcp_credentials.content
  }
}

resource "helm_release" "external-dns" {
  depends_on = [
    kubernetes_secret.external_dns,
    kubernetes_namespace.external_dns
  ]
  name             = "external-dns"
  namespace        = "external-dns"
  create_namespace = true
  chart            = "external-dns"
  repository       = "https://charts.bitnami.com/bitnami"
  cleanup_on_fail  = true
  replace          = true
  set {
    name  = "provider"
    value = "google"
  }
  set {
    name  = "google.project"
    value = var.gcp_project
  }
  set {
    name  = "logFormat"
    value = "json"
  }
  set {
    name  = "google.serviceAccountSecret"
    value = "external-dns"
  }
  set {
    name = "policy"
    value = "sync"
  }
}
