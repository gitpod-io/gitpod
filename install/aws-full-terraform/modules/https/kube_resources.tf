#
# Cluster Issuer
#

resource "kubectl_manifest" "cluster_issuer" {
  validate_schema = false
  depends_on = [
    null_resource.kubeconfig,
    helm_release.cert_manager,
  ]

  yaml_body = <<YAML
apiVersion: cert-manager.io/v1alpha2
kind: ClusterIssuer
metadata:
  name: letsencrypt-issuer
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: "${var.cert_manager.email}"
    privateKeySecretRef:
      name: letsencrypt-key
    solvers:
      - dns01:
          route53:
            region: ${var.aws.region}
            hostedZoneID: ${data.aws_route53_zone.zone.id}
            role: "${aws_iam_role.dns_manager.arn}"
YAML
}

#
# Certificate
#
resource "kubectl_manifest" "certificate" {
  validate_schema = false
  depends_on = [
    null_resource.kubeconfig,
    helm_release.cert_manager,
    kubectl_manifest.cluster_issuer,
  ]

  yaml_body = <<YAML
apiVersion: cert-manager.io/v1alpha2
kind: Certificate
metadata:
  name: gitpod-certificate
  namespace: ${var.gitpod.namespace}
spec:
  renewBefore: 24h
  secretName: proxy-config-certificates
  dnsNames:
    - "${var.dns.domain}"
    - "*.${var.dns.domain}"
    - "*.ws.${var.dns.domain}"
  issuerRef:
    name: letsencrypt-issuer
    kind: ClusterIssuer
YAML
}
