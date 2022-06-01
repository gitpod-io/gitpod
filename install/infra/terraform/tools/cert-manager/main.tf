provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
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
  namespace  = "cert-manager"
  create_namespace = true
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  wait       = true
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

  provisioner "local-exec" {
    command = "echo 'Waiting for cert-manager validating webhook to get its CA injected, so we can start to apply custom resources ...' && sleep 60"
  }
}

# the following is only for GCP managed DNS setup

data local_file "gcp_credentials" {
  count    = var.credentials == null ? 0 : 1
  filename = var.credentials
}

provider "kubernetes" {
  config_path = var.kubeconfig
}

resource "kubernetes_secret" "dns_solver" {
  count    = var.credentials == null ? 0 : 1
  depends_on = [
    helm_release.cert,
    data.local_file.gcp_credentials,
  ]
  metadata {
    name      = "clouddns-dns01-solver"
    namespace = "cert-manager"
  }
  data = {
    "keys.json" = "${data.local_file.gcp_credentials[0].content}"
  }
}
