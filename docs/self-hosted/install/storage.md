---
url: /docs/self-hosted/latest/install/storage/
---


#####TODO
# Workspace Storage

Gitpod uses bucket storage to persist the contents of workspaces. Each workspace is tarballed into a single archive file which is then uploaded to the bucket.

By default Gitpod ships with [MinIO](https://min.io/) as built-in bucket storage. If you operate your own MinIO instance, or have access to Google Cloud Bucket storage you can use that one. You have the following options:

* Integrated MinIO: If not disabled, Gitpod installs MinIO in Kubernetes as a dependency of Gitpod’s helm charts.
  MinIO itself can serve as a [gateway](https://github.com/minio/minio/tree/master/docs/gateway) to other storage providers.
  When storing the data itself, MinIO relies on a [persistent volume](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) which in turn supports a [wide range of storage backends](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#types-of-persistent-volumes).
* Bring your own storage bucket: Gitpod can be configured to connect to your own installation of MinIO or Google Cloud Storage compatible storage solution.

This helm chart ships with a [MinIO](https://min.io/) installation for this purpose. 
Alternatively, you can connect to your own [MinIO](https://min.io/) installation using
 - `echo values/minio.yaml >> configuration.txt`
 - in `values.minio.yaml` change the values to match your installation
