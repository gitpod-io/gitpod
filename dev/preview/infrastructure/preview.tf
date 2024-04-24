module "preview_gce" {
  count  = 1
  source = "./modules/gce"

  preview_name  = var.preview_name
  cert_issuer   = var.cert_issuer
  use_spot      = var.gce_use_spot
  with_large_vm = var.with_large_vm
  vm_type       = var.vm_type

  providers = {
    google           = google,
    acme.letsencrypt = acme.letsencrypt,
    acme.zerossl     = acme.zerossl,
  }
}

module "dns" {
  source = "./modules/dns"

  preview_name = var.preview_name

  # a bit of a hack to choose the correct ip for the dns records, based on whichever module gets created
  preview_ip = module.preview_gce[0].preview_ip

  workspace_ip = module.preview_gce[0].workspace_ip

  cert_issuer     = var.cert_issuer
  gcp_project_dns = var.gcp_project_dns

  providers = {
    google           = google,
    acme.letsencrypt = acme.letsencrypt,
    acme.zerossl     = acme.zerossl,
  }
}
