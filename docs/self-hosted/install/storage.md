---
url: /docs/self-hosted/latest/install/storage/
---

# Workspace Storage

Gitpod uses bucket storage to persist the contents of workspaces. Each workspace is tarballed into a single archive file which is then uploaded to a separate bucket.

By default Gitpod installs [MinIO](https://min.io/) as built-in bucket storage which uses a [persistent volume](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) to store workspace content.

For more complex use case we recommend configuring more permanent means of persistence by either:
 * Configure the contained MinIO-instance to serve as a [gateway](https://github.com/minio/minio/tree/master/docs/gateway) OR configure one of a [wide range of storage backends](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#types-of-persistent-volumes).
 * Bring your own storage bucket: Configure Gitpod to either connect to:
   * your own installation of MinIO
   * a Google Cloud Storage compatible storage solution


## a) Configure custom MinIO instance

 1. Create a file `values.custom.yaml` with this content:
    ```yaml
    components:
      contentService:
        remoteStorage:
          kind: minio
          minio:
            endpoint: your-minio-installation.somewhere-else.com:8080
            accessKey: enterKeyHere
            secretKey: superSecretKeyGoesHere
            tmpdir: /tmp

    # Disable built-in minio instance
    minio:
      enabled: false
    ```
 2. Redeploy Gitpod using `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes

    > Note that Helm does _not_ merge hierarchies in a single file. Please make sure there is only ever _one_ `components` hierarchy or the last one overwrites all previous values.

## b) Configure the built-in MinIO instance
 1. Consult the chart's documentation at https://helm.min.io/
 2. Create a file `values.custom.yaml` with this content:
    ```yaml
    minio:
      accessKey: add-a-radom-access-key-here
      secretKey: add-a-radom-secret-key-here
      # insert custom config here
    ```
 3. Redeploy Gitpod using `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes
