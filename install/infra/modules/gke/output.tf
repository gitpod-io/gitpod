output "kubernetes_endpoint" {
  sensitive = true
  value     = module.gke_auth.host
}

output "name_servers" {
  value = google_dns_managed_zone.gitpod-dns-zone[0].name_servers
}

output "client_token" {
  sensitive = true
  value     = module.gke_auth.token
}

output "ca_certificate" {
  sensitive = true
  value     = module.gke_auth.cluster_ca_certificate
}

output "kubeconfig" {
  sensitive = true
  value     = module.gke_auth.kubeconfig_raw
}

output "cluster-sa" {
  sensitive = true
  value = google_service_account_key.gke_sa_key.private_key
}

output "database" {
  sensitive = true
  value = try({
    instance            = "${var.project}:${var.region}:${google_sql_database_instance.gitpod[0].name}"
    username            = "${google_sql_user.users[0].name}"
    password            = random_password.password[0].result
    service_account_key = base64decode(google_service_account_key.db_sa_key[0].private_key)
  }, "No database created")
}

output "registry" {
  sensitive = true
  value = try({
    url      = data.google_container_registry_repository.gitpod[0].repository_url
    server   = regex("[^/?#]*", data.google_container_registry_repository.gitpod[0].repository_url)
    username = "_json_key"
    password = base64decode(google_service_account_key.obj_sa_key[0].private_key)
  }, "No container registry created")
}

output "dns_credentials" {
  sensitive = true
  value = var.domain_name == null ? "" : base64decode(google_service_account_key.dns_sa_key[0].private_key)
}

output "storage" {
  sensitive = true
  value = try({
    region              = var.region
    project             = var.project
    service_account_key = base64decode(google_service_account_key.obj_sa_key[0].private_key)
  }, "No GCS bucket created for object storage")
}
