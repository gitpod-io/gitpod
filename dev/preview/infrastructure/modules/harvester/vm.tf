locals {
  vm_storage_class = format("longhorn-%s-onereplica", var.vm_image)
}

resource "harvester_virtualmachine" "harvester" {
  provider             = harvester.harvester
  name                 = var.preview_name
  namespace            = var.preview_namespace
  restart_after_update = true

  tags = {
    ssh-user = "ubuntu"
    os       = "ubuntu"
  }

  ssh_keys = [
    harvester_ssh_key.harvester_ssh_key.id
  ]

  cpu    = local.vm_cpu
  memory = local.vm_memory

  run_strategy = "RerunOnFailure"
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

    access_mode        = "ReadWriteOnce"
    volume_mode        = "Block"
    storage_class_name = local.vm_storage_class
    auto_delete        = true
  }

  disk {
    name = "storage"
    type = "disk"
    size = "30Gi"
    bus  = "virtio"

    access_mode        = "ReadWriteOnce"
    volume_mode        = "Block"
    storage_class_name = "longhorn-onereplica"
    auto_delete        = true
  }

  cloudinit {
    user_data_secret_name    = kubernetes_secret.cloudinit.metadata[0].name
    network_data_secret_name = kubernetes_secret.cloudinit.metadata[0].name
  }
}

resource "harvester_ssh_key" "harvester_ssh_key" {
  provider  = harvester.harvester
  name      = "${var.preview_name}-ssh-key"
  namespace = var.preview_namespace

  public_key = var.ssh_key
}

resource "kubernetes_secret" "cloudinit" {
  provider = k8s.harvester
  metadata {
    name      = local.vm_cloud_init_secret_name
    namespace = var.preview_namespace
  }

  data = {
    networkdata = ""
    userdata    = local.cloudinit_user_data
  }
}

data "kubernetes_secret" "harvester-k3s-dockerhub-pull-account" {
  provider = k8s.dev
  metadata {
    name      = "harvester-k3s-dockerhub-pull-account"
    namespace = "werft"
  }
}

locals {
  vm_cloud_init_secret_name = "userdata-${var.preview_name}"
  cloudinit_user_data = templatefile("${path.module}/cloudinit.yaml", {
    dockerhub_user      = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["username"]
    dockerhub_passwd    = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["password"]
    ssh_authorized_keys = var.ssh_key
    install-k3s = templatefile("${path.module}/../../scripts/bootstrap-k3s.sh", {
      vm_name = var.preview_name
    })
  })

  vm_cpu    = var.with_large_vm ? 12 : 6
  vm_memory = var.with_large_vm ? "24Gi" : "12Gi"
}
