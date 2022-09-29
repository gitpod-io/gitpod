variable "kubeconfig" {
  description = "Path to the KUBECONFIG file to connect to the cluster"
  default     = "./kubeconfig"
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

resource "helm_release" "calico" {
  name             = "tigera-operator"
  repository       = "https://projectcalico.docs.tigera.io/charts"
  chart            = "tigera-operator"
  namespace        = "tigera-operator"
  version          = "v3.24.1"
  create_namespace = true
}
