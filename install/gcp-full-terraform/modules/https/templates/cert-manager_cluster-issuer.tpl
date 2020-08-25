apiVersion: cert-manager.io/v1alpha2
kind: ClusterIssuer
metadata:
  name: letsencrypt-issuer
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: "${email}"
    privateKeySecretRef:
      name: letsencrypt-key
    solvers:
      - dns01:
          clouddns:
            # The ID of the GCP project
            project: ${project}
            # This is the secret used to access the service account
            serviceAccountSecretRef:
              name: clouddns-dns01-solver-svc-acct
              key: key.json