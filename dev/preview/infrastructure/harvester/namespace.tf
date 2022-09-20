resource "kubernetes_namespace" "example" {
  provider = k8s.harvester
  metadata {
    name = "preview-${var.preview_name}"
  }
}
