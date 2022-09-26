resource "harvester_virtualmachine" "harvester" {
  name                 = var.preview_name
  namespace            = kubernetes_namespace.preview_namespace.metadata[0].name
  restart_after_update = true

  tags = {
    ssh-user = "ubuntu"
  }

  cpu    = var.vm_cpu
  memory = var.vm_memory

  run_strategy = "RerunOnFailure"
  hostname     = var.preview_name
  machine_type = "q35"

  network_interface {
    name  = "default"
    type  = "masquerade"
    model = "virtio"
  }

  disk {
    name       = "system"
    type       = "disk"
    size       = "200Gi"
    bus        = "scsi"
    boot_order = 1

    image              = var.vm_image
    access_mode        = "ReadWriteOnce"
    volume_mode        = "Block"
    storage_class_name = var.vm_storage_class
    auto_delete        = true
  }

  disk {
    name               = "storage"
    type               = "disk"
    size               = "30Gi"
    bus                = "virtio"
    access_mode        = "ReadWriteOnce"
    volume_mode        = "Block"
    storage_class_name = "longhorn"
    auto_delete        = true
  }

  cloudinit {
    user_data_secret_name    = kubernetes_secret.cloudinit.metadata[0].name
    network_data_secret_name = kubernetes_secret.cloudinit.metadata[0].name
  }
}

resource "kubernetes_secret" "cloudinit" {
  provider = k8s.harvester
  metadata {
    name      = local.vm_cloud_init_secret_name
    namespace = kubernetes_namespace.preview_namespace.metadata[0].name
  }

  data = {
    networkdata = ""
    userdata    = base64encode(local.cloudinit_user_data)
  }
}

#resource "harvester_ssh_key" "ssh-key" {
#  name      = "mysshkey"
#  namespace = kubernetes_namespace.preview_namespace.metadata[0].name
#
#  public_key = ""
#}


locals {
  cloudinit_user_data = file("${path.module}/cloudinit.yaml")

  ssh_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC/aB/HYsb56V0NBOEab6j33v3LIxRiGqG4fmidAryAXevLyTANJPF8m44KSzSQg7AI7PMy6egxQp/JqH2b+3z1cItWuHZSU+klsKNuf5HxK7AOrND3ahbejZfyYewtKFQ3X9rv5Sk8TAR5gw5oPbkTR61jiLa58Sw7UkhLm2EDguGASb6mBal8iboiF8Wpl8QIvPmJaGIOY2YwXLepwFA3S3kVqW88eh2WFmjTMre5ASLguYNkHXjyb/TuhVFzAvphzpl84RAaEyjKYnk45fh4xRXx+oKqlfKRJJ/Owxa7SmGO+/4rWb3chdnpodHeu7XjERmjYLY+r46sf6n6ySgEht1xAWjMb1uqZqkDx+fDDsjFSeaN3ncX6HSoDOrphFmXYSwaMpZ8v67A791fuUPrMLC+YMckhTuX2g4i3XUdumIWvhaMvKhy/JRRMsfUH0h+KAkBLI6tn5ozoXiQhgM4SAE5HsMr6CydSIzab0yY3sq0avmZgeoc78+8PKPkZG1zRMEspV/hKKBC8hq7nm0bu4IgzuEIYHowOD8svqA0ufhDWxTt6A4Jo0xDzhFyKme7KfmW7SIhpejf3T1Wlf+QINs1hURr8LSOZEyY2SzYmAoQ49N0SSPb5xyG44cptpKcj0WCAJjBJoZqz0F5x9TjJ8XToB5obyJfRHD1JjxoMQ== dev@gitpod.io"
}