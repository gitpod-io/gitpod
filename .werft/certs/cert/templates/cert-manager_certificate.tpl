apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${cert_name}
  namespace: ${cert_namespace}
spec:
  secretName: ${cert_name}
  renewBefore: 24h
  dnsNames: ${cert_dns_names}
  issuerRef:
    name: letsencrypt-issuer
    kind: ClusterIssuer