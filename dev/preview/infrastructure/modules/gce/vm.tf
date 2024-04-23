data "google_compute_default_service_account" "default" {
  provider = google
}

data "google_service_account" "node_service_account" {
  account_id = "preview-environmnet-node"
}

resource "google_compute_instance" "default" {
  provider = google

  name                      = local.vm_name
  machine_type              = local.machine_type
  zone                      = "europe-west1-c"
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "projects/workspace-clusters/global/images/${var.vm_image}"
      type  = "pd-ssd"
      size  = 256
    }
  }

  # Attach two local SSDs when large VM is enabled.
  # These increase the containerd and workspace lvm volume sizes,
  # allowing us to e.g. run more e2e tests in parallel without
  # running into node disk pressure.
  dynamic "scratch_disk" {
    for_each = var.with_large_vm == true ? [1, 2] : []
    content {
      interface = "NVME"
    }
  }

  tags = ["preview"]


  dynamic "scheduling" {
    for_each = var.use_spot == true ? [1] : []
    content {
      provisioning_model          = "SPOT"
      preemptible                 = true
      automatic_restart           = false
      instance_termination_action = "DELETE"
    }
  }

  metadata = {
    ssh-keys           = "ubuntu:${var.ssh_key}"
    serial-port-enable = true
    user-data          = local.cloudinit_user_data
  }

  network_interface {
    network = "default"

    access_config {
      nat_ip = google_compute_address.static-preview-ip.address
    }
  }

  metadata_startup_script = local.startup_script

  service_account {
    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    email  = data.google_service_account.node_service_account.email
    scopes = ["cloud-platform"]
  }
}

resource "google_compute_address" "static-preview-ip" {
  provider = google
  region   = "europe-west1"
  name     = var.preview_name
}

# data "google_secret_manager_secret_version" "dockerhub-pull-account" {
#   provider = google
#   secret   = "dockerhub-pull-account"
# }

locals {
  vm_name = "preview-${var.preview_name}"
  bootstrap_script = templatefile("${path.module}/../../scripts/bootstrap-k3s.sh", {
    vm_name = local.vm_name
  })

  trustmanager_script = file("${path.module}/../../scripts/install-trustmanager.sh")

  startup_script = <<-EOT
    ${local.bootstrap_script}
    ${local.trustmanager_script}
  EOT

  cloudinit_user_data = templatefile("${path.module}/cloudinit.yaml", {
    # dockerhub_user      = base64decode(jsondecode(data.google_secret_manager_secret_version.dockerhub-pull-account.secret_data).username)
    # dockerhub_passwd    = base64decode(jsondecode(data.google_secret_manager_secret_version.dockerhub-pull-account.secret_data).password)
    vm_name             = local.vm_name
    ssh_authorized_keys = var.ssh_key
  })

  machine_type = var.with_large_vm ? "n2d-standard-32" : var.vm_type
}
