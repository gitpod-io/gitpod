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
