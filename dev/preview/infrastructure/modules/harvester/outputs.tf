output "workspace_ip" {
  value = kubernetes_service.dev-svc.status[0].load_balancer[0].ingress[0].ip
}

output "preview_ip" {
  value = var.harvester_ingress_ip
}
