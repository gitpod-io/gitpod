resource "null_resource" "wait_for_certs" {
  provisioner "local-exec" {
    command = "bash ${path.module}/scripts/wait_for_certificate.sh"
  }

  depends_on = [
    null_resource.kubeconfig,
    kubectl_manifest.cluster_issuer,
    kubectl_manifest.certificate
  ]
}
