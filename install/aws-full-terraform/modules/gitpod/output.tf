output "external_dns" {
  value = data.kubernetes_service.proxy.load_balancer_ingress.0.hostname
}
