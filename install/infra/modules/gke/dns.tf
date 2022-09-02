resource "google_service_account" "dns_sa" {
  account_id   = local.dns_sa
  display_name = "Service Account managed by TF for DNS"
}

resource "google_project_iam_member" "dns-sa-iam" {
  project = var.project
  role = "roles/dns.admin"

  member = "serviceAccount:${google_service_account.dns_sa.email}"
}

resource "google_service_account_key" "dns_sa_key" {
  service_account_id = google_service_account.dns_sa.name
}

resource "local_file" "dns-credentials" {
  filename = "dns-credentials.json"
  content  = base64decode(google_service_account_key.dns_sa_key.private_key)
}

resource "google_dns_managed_zone" "gitpod-dns-zone" {
  count = var.domain_name == null ? 0 : 1

  name          = "zone-${var.cluster_name}"
  dns_name      = "${var.domain_name}."
  description   = "Terraform managed DNS zone for ${var.cluster_name}"
  force_destroy = true
  labels = {
    app = "gitpod"
  }
}
