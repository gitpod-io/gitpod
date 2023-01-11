data "google_compute_default_service_account" "default" {
  provider = google
}

resource "google_compute_instance" "default" {
  provider     = google
  name         = var.preview_name
  machine_type = "n2-standard-8"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "projects/workspace-clusters/global/images/${var.vmi}"
    }
  }

  tags = ["preview"]

  #  scheduling {
  #    provisioning_model          = "SPOT"
  #    preemptible                 = true
  #    automatic_restart           = false
  #    instance_termination_action = "STOP"
  #  }

  metadata = {
    ssh-keys           = "dev:${file(pathexpand("~/.ssh/vm_id_rsa.pub"))}"
    serial-port-enable = true
    user-data          = local.cloudinit_user_data
  }

  network_interface {
    network = "default"

    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = local.startup_script

  service_account {
    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    email  = data.google_compute_default_service_account.default.email
    scopes = ["cloud-platform"]
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
  startup_script = templatefile("${path.module}/startup-script.sh", {
    dockerhub_user   = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["username"]
    dockerhub_passwd = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["password"]
    vm_name          = var.preview_name
  })

  cloudinit_user_data = templatefile("${path.module}/cloudinit.yaml", {
    dockerhub_user      = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["username"]
    dockerhub_passwd    = data.kubernetes_secret.harvester-k3s-dockerhub-pull-account.data["password"]
    vm_name             = var.preview_name
    ssh_authorized_keys = local.ssh_key
  })

  ssh_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC/aB/HYsb56V0NBOEab6j33v3LIxRiGqG4fmidAryAXevLyTANJPF8m44KSzSQg7AI7PMy6egxQp/JqH2b+3z1cItWuHZSU+klsKNuf5HxK7AOrND3ahbejZfyYewtKFQ3X9rv5Sk8TAR5gw5oPbkTR61jiLa58Sw7UkhLm2EDguGASb6mBal8iboiF8Wpl8QIvPmJaGIOY2YwXLepwFA3S3kVqW88eh2WFmjTMre5ASLguYNkHXjyb/TuhVFzAvphzpl84RAaEyjKYnk45fh4xRXx+oKqlfKRJJ/Owxa7SmGO+/4rWb3chdnpodHeu7XjERmjYLY+r46sf6n6ySgEht1xAWjMb1uqZqkDx+fDDsjFSeaN3ncX6HSoDOrphFmXYSwaMpZ8v67A791fuUPrMLC+YMckhTuX2g4i3XUdumIWvhaMvKhy/JRRMsfUH0h+KAkBLI6tn5ozoXiQhgM4SAE5HsMr6CydSIzab0yY3sq0avmZgeoc78+8PKPkZG1zRMEspV/hKKBC8hq7nm0bu4IgzuEIYHowOD8svqA0ufhDWxTt6A4Jo0xDzhFyKme7KfmW7SIhpejf3T1Wlf+QINs1hURr8LSOZEyY2SzYmAoQ49N0SSPb5xyG44cptpKcj0WCAJjBJoZqz0F5x9TjJ8XToB5obyJfRHD1JjxoMQ== dev@gitpod.io"
}
