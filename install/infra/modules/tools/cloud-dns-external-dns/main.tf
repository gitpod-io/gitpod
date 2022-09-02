provider "kubernetes" {
  config_path = var.kubeconfig
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
    "credentials.json" = var.credentials
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
    value = var.project
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
    name = "txt-owner-id"
    value = var.txt_owner_id
  }
}
