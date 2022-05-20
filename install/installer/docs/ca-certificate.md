# Add own CA certificate to your Gitpod installation

When you want to use TLS certificates that are signed by a custom [CA](https://en.wikipedia.org/wiki/Certificate_authority), you can add this CA certificate to your Gitpod installation in order to make sure that Gitpod accepts these certificates.

Follow these steps to add your own CA certificate:

1. Save your CA certificate in a file called `ca.crt`.
2. Add a secret with the CA certificate like this:
   ```
   kubectl create secret generic ca-certificate --from-file=ca.crt=./ca.crt
   ```
3. Add the following config to your `gitpod.config.yaml` file:
   ```
   customCACert:
     kind: secret
     name: ca-certificate
   ```
