---
url: /docs/self-hosted/latest/install/docker-registry/
---

#####TODO
# Docker Registry

Gitpod builds Docker images during workspace startup. This enables custom Dockerfiles as part of your workspace config, but is also required for Gitpod itself to function.
To this end, Gitpod requires a container registry where it can push the images it builds.

By default Gitpod ships with a built-in Docker registry. If you operate your own Docker registry (which we'd recommend in a production setting) you can use that one. You have the following options:

* Integrated docker registry: If not disabled, this docker registry is installed in a Kubernetes Pod as a dependency of Gitpod’s Helm chart.
  The docker registry requires a Kubernetes PersistentVolume. This registry is not recommended to be used for production.
* Own docker registry: Gitpod can connect to your own docker registry. Compared to its built-in counterpart this enables performance gains and access to otherwise private images.

This helm chart can either deploy its own registry (default but requires [HTTPS certs](../https-certs/)) or use an existing one.
To connect to an existing Docker registry, do the following steps:

```
echo values/registry.yaml >> configuration.txt
```

In `values/registry.yaml` replace `your.registry.com` with the name of your registry.

Login to the registry and safe the authentication
```
docker --config secrets/ login your.registry.com && mv secrets/config.json secrets/registry-auth.json
```

Make sure the resulting JSON file contains the credentials (there should be an `auth` section containing them as base64 encoded string).

If that's not the case you might have a credential store/helper set up (e.g. on macOS the _Securely store Docker logins in macOS keychain_ setting).
