# gitpod-ca-updater

Container image to update CA certificates in environments where is
not possible to download updates or with restricted Internet access.

The container uses **Ubuntu** as base image due to [issues in alpine](https://github.com/gliderlabs/docker-alpine/issues/52)
to add custom CA certificates.
