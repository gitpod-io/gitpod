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
    port {
      name        = "admin-port"
      protocol    = "TCP"
      port        = 444
      target_port = 4440
    }
    selector = {
      "gitpod.io/lbName" = var.preview_name
    }
    type = "LoadBalancer"
  }
}

# Proxy service in the HARVESTER cluster, same namespace
resource "kubernetes_service" "harvester-svc" {
  provider = k8s.harvester
  metadata {
    name      = "proxy"
    namespace = kubernetes_namespace.preview_namespace.metadata[0].name
  }

  spec {
    port {
      name        = "ssh-gateway"
      protocol    = "TCP"
      port        = 22
      target_port = 22
    }
    port {
      name        = "vm-ssh"
      protocol    = "TCP"
      port        = 2200
      target_port = 2200
    }
    port {
      name        = "http"
      protocol    = "TCP"
      port        = 80
      target_port = 80
    }
    port {
      name        = "https"
      protocol    = "TCP"
      port        = 443
      target_port = 443
    }
    port {
      name        = "admin-port"
      protocol    = "TCP"
      port        = 444
      target_port = 444
    }
    port {
      name        = "kube-api"
      protocol    = "TCP"
      port        = 6443
      target_port = 6443
    }
    port {
      name        = "prometheus"
      protocol    = "TCP"
      port        = 9090
      target_port = 32001
    }
    port {
      name        = "grafana"
      protocol    = "TCP"
      port        = 3000
      target_port = 32000
    }

    selector = {
      "harvesterhci.io/vmName" = var.preview_name
    }

    type = "ClusterIP"
  }
}
