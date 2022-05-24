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

resource "random_id" "id" {
  byte_length = 4
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

#create namespace for cert mananger
resource "kubernetes_namespace" "cert" {
  metadata {
    name = "cert-manager"
  }
}

#create namespace for external-dns
resource "kubernetes_namespace" "external_dns" {
  metadata {
    name = "external-dns"
  }
}


variable "extraArgs" {
  description = "List of additional arguments for cert-manager"
  type        = list(any)
  default = [
    "--dns01-recursive-nameservers-only",
    "--dns01-recursive-nameservers=8.8.8.8:53\\,1.1.1.1:53",
  ]
}


#deploy cert manager
resource "helm_release" "cert" {
  name       = "cert-manager"
  namespace  = kubernetes_namespace.cert.metadata[0].name
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  depends_on = [kubernetes_namespace.cert]
  set {
    name  = "version"
    value = "v1.8.0"
  }
  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "extraArgs"
    value = "{${join(",", var.extraArgs)}}"
  }
}

resource "google_dns_record_set" "a" {
  name         = "${var.gcp_sub_domain}.gitpod-self-hosted.com."
  managed_zone = "gitpod-self-hosted-com"
  type         = "A"
  ttl          = 5
  project      = var.gcp_project

  rrdatas = regex("https?://(\\d{1,3}.\\d{1,3}.\\d{1,3}.\\d{1,3}):?", yamldecode(file(var.kubeconfig)).clusters[0].cluster.server)
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

resource "kubernetes_secret" "dns_solver" {
  depends_on = [
    helm_release.cert,
  ]
  metadata {
    name      = "clouddns-dns01-solver"
    namespace = "cert-manager"
  }
  data = {
    "keys.json" = "${data.local_file.gcp_credentials.content}"
  }
}
