resource "google_dns_managed_zone" "gitpod-dns-zone" {
  count         = var.domain_name == null ? 0 : 1
  name          = "zone-${var.name}"
  dns_name      = "${var.domain_name}."
  description   = "Terraform managed DNS zone for ${var.name}"
  force_destroy = true
  labels = {
    app = "gitpod"
  }
}

resource "google_dns_record_set" "gitpod-dns" {
  for_each     = local.dns_list
  name         = each.key
  managed_zone = google_dns_managed_zone.gitpod-dns-zone[0].name
  project      = var.gcp_project
  type         = "A"
  ttl          = 5

  rrdatas = [google_compute_instance.k3s_master_instance.network_interface[0].access_config[0].nat_ip]
}
