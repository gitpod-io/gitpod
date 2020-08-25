apiVersion: cert-manager.io/v1alpha2
kind: Certificate
metadata:
  name: gitpod-certificate
  namespace: ${namespace}
spec:
  secretName: ${secretName}
  renewBefore: 24h
  dnsNames:
    - "${dns_zone}"
    - "*.${dns_zone}"
    - "*.ws.${dns_zone}"
  issuerRef:
    name: letsencrypt-issuer
    kind: ClusterIssuer