---
url: /docs/self-hosted/0.5.0/admin/admin/
---

# Administrate Gitpod Self-Hosted

While we are working on the administration experience, there is already a lot you can do if you know where to look.


## Download a backup of a workspace

Workpaces are stored as tar files in Minio or Google Storage buckets (depending on your configuration).
The tar files can be downloaded from there and unpacked locally.


## List all running workspaces

`SELECT`....

`kubectl get pods`

## Stop a running workspace

`kubectl delete pod`


## Connect to built-in Registry
