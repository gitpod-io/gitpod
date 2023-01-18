resource "kubernetes_deployment" "dev-loadbalancer" {
  provider = k8s.dev

  metadata {
    name      = "lb-${var.preview_name}"
    namespace = "loadbalancers"
    labels = {
      "gitpod.io/lbName" = var.preview_name
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "gitpod.io/lbName" = var.preview_name
      }
    }

    template {
      metadata {
        name = "lb"
        labels = {
          "gitpod.io/lbName" = var.preview_name
        }
      }

      spec {
        service_account_name = "proxy"
        enable_service_links = false

        volume {
          name = "kubeconfig"
          secret {
            secret_name = "harvester-kubeconfig"
          }
        }

        container {
          image = "bitnami/kubectl:1.25.2"
          name  = "kubectl"
          args = [
            "port-forward",
            "--kubeconfig",
            "/mnt/kubeconfig/harvester-kubeconfig.yml",
            "-n",
            var.preview_namespace,
            "--address=0.0.0.0",
            "--pod-running-timeout=2m",
            "svc/proxy",
            "4430:443",
            "2200:22",
          ]

          volume_mount {
            mount_path = "/mnt/kubeconfig/"
            name       = "kubeconfig"
            read_only  = true
          }
        }
      }
    }
  }
}
