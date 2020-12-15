# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: ${name}
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: "${email}"
    privateKeySecretRef:
      name: ${key_name}
    solvers:
      - dns01:
          cloudDNS:
            # The ID of the GCP project
            project: ${project}
            # This is the secret used to access the service account
            serviceAccountSecretRef:
              name: ${secret_name}
              key: credentials.json
