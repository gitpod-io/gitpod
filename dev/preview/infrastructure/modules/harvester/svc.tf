# Load balancer in the DEV cluster
resource "kubernetes_service" "dev-svc" {
  provider               = k8s.dev
  wait_for_load_balancer = true
  metadata {
    name      = "lb-${var.preview_name}"
    namespace = "loadbalancers"
  }
  spec {
    port {
      name        = "ssh-gateway"
      protocol    = "TCP"
      port        = 22
      target_port = 2200
    }
    port {
      name        = "https"
      protocol    = "TCP"
      port        = 443
      target_port = 4430
    }
    selector = {
      "gitpod.io/lbName" = var.preview_name
    }
    type = "LoadBalancer"
  }
}
