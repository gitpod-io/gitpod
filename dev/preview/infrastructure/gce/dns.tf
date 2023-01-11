module "dns" {
  source = "../modules/dns"

  preview_name     = var.preview_name
  preview_ip       = var.harvester_ingress_ip
  workspace_ip     = google_compute_instance.default.network_interface.0.access_config.0.nat_ip
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
