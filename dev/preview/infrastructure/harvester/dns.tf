module "dns" {
  source = "../modules/dns"

  preview_name     = var.preview_name
  preview_ip       = var.harvester_ingress_ip
  workspace_ip     = kubernetes_service.dev-svc.status[0].load_balancer[0].ingress[0].ip
  cert_issuer      = var.cert_issuer
  dev_kube_context = var.dev_kube_context
  kubeconfig_path  = var.kubeconfig_path
  gcp_project_dns  = var.gcp_project_dns

  providers = {
    google           = google,
    acme.letsencrypt = acme.letsencrypt,
    acme.zerossl     = acme.zerossl,
    k8s.dev          = k8s.dev
  }
}
