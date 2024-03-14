module "preview_gce" {
  count  = 1
  source = "./modules/gce"

  preview_name  = var.preview_name
  cert_issuer   = var.cert_issuer
  ssh_key       = local.ssh_key
  use_spot      = var.gce_use_spot
  with_large_vm = var.with_large_vm
  vm_type       = var.vm_type

  providers = {
    google           = google,
    acme.letsencrypt = acme.letsencrypt,
    acme.zerossl     = acme.zerossl,
    k8s.dev          = k8s.dev
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
    k8s.dev          = k8s.dev
  }
}

locals {
  ssh_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC/aB/HYsb56V0NBOEab6j33v3LIxRiGqG4fmidAryAXevLyTANJPF8m44KSzSQg7AI7PMy6egxQp/JqH2b+3z1cItWuHZSU+klsKNuf5HxK7AOrND3ahbejZfyYewtKFQ3X9rv5Sk8TAR5gw5oPbkTR61jiLa58Sw7UkhLm2EDguGASb6mBal8iboiF8Wpl8QIvPmJaGIOY2YwXLepwFA3S3kVqW88eh2WFmjTMre5ASLguYNkHXjyb/TuhVFzAvphzpl84RAaEyjKYnk45fh4xRXx+oKqlfKRJJ/Owxa7SmGO+/4rWb3chdnpodHeu7XjERmjYLY+r46sf6n6ySgEht1xAWjMb1uqZqkDx+fDDsjFSeaN3ncX6HSoDOrphFmXYSwaMpZ8v67A791fuUPrMLC+YMckhTuX2g4i3XUdumIWvhaMvKhy/JRRMsfUH0h+KAkBLI6tn5ozoXiQhgM4SAE5HsMr6CydSIzab0yY3sq0avmZgeoc78+8PKPkZG1zRMEspV/hKKBC8hq7nm0bu4IgzuEIYHowOD8svqA0ufhDWxTt6A4Jo0xDzhFyKme7KfmW7SIhpejf3T1Wlf+QINs1hURr8LSOZEyY2SzYmAoQ49N0SSPb5xyG44cptpKcj0WCAJjBJoZqz0F5x9TjJ8XToB5obyJfRHD1JjxoMQ== dev@gitpod.io"
}
