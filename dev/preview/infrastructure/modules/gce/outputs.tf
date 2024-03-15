output "workspace_ip" {
  value = google_compute_instance.default.network_interface.0.access_config.0.nat_ip
}

output "preview_ip" {
  value = google_compute_instance.default.network_interface.0.access_config.0.nat_ip
}
