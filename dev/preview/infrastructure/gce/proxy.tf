resource "kubernetes_pod" "proxy" {
  provider = k8s.harvester
  metadata {
    name      = "proxy"
    namespace = kubernetes_namespace.preview_namespace.metadata[0].name
    labels = {
      "preview-name" = var.preview_name
    }
  }

  spec {
    container {
      name              = "socat"
      image             = "alpine/socat"
      image_pull_policy = "IfNotPresent"
      command           = ["/bin/ash"]
      # dumb port-forward directly to the machine
      # those should be all the ports that need to be accessible in a preview env
      # we also forward 22,2200 to 2222, as 22 is disabled in the vm image and we don't want to change that
      args = [
        "-c",
        "for i in 22 2200; do socat TCP-LISTEN:$i,fork,reuseaddr TCP:${google_compute_instance.default.network_interface.0.access_config.0.nat_ip}:2222 & done; for i in 80 443 6443 9090 3000; do socat TCP-LISTEN:$i,fork,reuseaddr TCP:${google_compute_instance.default.network_interface.0.access_config.0.nat_ip}:$i & done; wait"
      ]
    }
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
      name        = "gce-ssh"
      protocol    = "TCP"
      port        = 2222
      target_port = 2222
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
      "preview-name" = var.preview_name
    }

    type = "ClusterIP"
  }
}
