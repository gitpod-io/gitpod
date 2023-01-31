resource "kubernetes_pod" "proxy" {
  provider = k8s.harvester
  metadata {
    name      = "proxy"
    namespace = var.preview_namespace
    # this label should match the one in ../../svc.tf
    # and is the same as the one that a pod running a harvester vm has
    labels = {
      "harvesterhci.io/vmName" = var.preview_name
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
