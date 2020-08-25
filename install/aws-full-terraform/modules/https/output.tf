output "ready" {
  value = ""
  depends_on = [
    null_resource.wait_for_certs
  ]
}
