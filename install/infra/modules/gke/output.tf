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

output "database" {
  sensitive = true
  value = try({
    instance            = "${var.project}:${var.region}:${google_sql_database_instance.gitpod[0].name}"
    username            = "${google_sql_user.users[0].name}"
    password            = random_password.password[0].result
    service_account_key_path = "./mysql-credentials.json"
  }, "No database created")
}

output "registry" {
  sensitive = true
  value = try({
    url      = data.google_container_registry_repository.gitpod[0].repository_url
    server   = regex("[^/?#]*", data.google_container_registry_repository.gitpod[0].repository_url)
    username = "_json_key"
    password = "Copy the output of the command: cat ./gs-credentials.json | tr -s '\n' ' '"
  }, "No container registry created")
}

output "dns_credentials_path" {
  sensitive = false
  value = var.domain_name == null ? "" : "./dns-credentials.json"
}

output "storage" {
  sensitive = true
  value = try({
    region      = var.region
    project     = var.project
    service_account_key_path = "./gs-credentials.json"
  }, "No GCS bucket created for object storage")
}
