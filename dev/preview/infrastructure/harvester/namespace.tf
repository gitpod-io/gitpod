resource "kubernetes_namespace" "preview_namespace" {
  provider = k8s.harvester
  metadata {
    name = "test-preview-${var.preview_name}"
  }
}
