resource "kubernetes_namespace" "preview_namespace" {
  provider = k8s.harvester
  metadata {
    name = "preview-${var.preview_name}"
  }
}
