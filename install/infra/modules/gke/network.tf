resource "google_compute_network" "vpc" {
  name                    = "vpc-${var.cluster_name}"
  auto_create_subnetworks = "false"
}

resource "google_compute_subnetwork" "subnet" {
  name          = "subnet-${var.cluster_name}"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.255.0.0/16"

  secondary_ip_range {
    range_name    = "cluster-secondary-ip-range"
    ip_cidr_range = "10.0.0.0/12"
  }

  secondary_ip_range {
    range_name    = "services-secondary-ip-range"
    ip_cidr_range = "10.64.0.0/12"
  }
}
