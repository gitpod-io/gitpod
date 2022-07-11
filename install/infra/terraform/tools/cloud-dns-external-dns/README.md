# Managed DNS terraform module

This module is used in test setup, to deploy `cert-manager` and `external-dns`
on a created cluster, and to create a secret that the aforementioned deployments
can use to modify a `cloudDNS` record. This module works specifically for the
domain `gitpod-self-hosted.com`.
