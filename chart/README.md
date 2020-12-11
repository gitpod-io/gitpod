# Gitpod Self-Hosted

[gitpod.io](https://gitpod.io) is a service that provides developers with ready-to-code dev environments in the cloud.

This [Helm](https://helm.sh) chart allows you to deploy and operate an instance of Gitpod on your own infrastructure.


## Prerequisites

- Kubernetes 1.13+
- Helm 3+


## Get Repo Info

```console
helm repo add charts.gitpod.io https://charts.gitpod.io
helm repo add stable https://charts.helm.sh/stable
helm repo add stable https://helm.min.io/
helm repo update
```

_See [helm repo](https://helm.sh/docs/helm/helm_repo/) for command documentation._


## Install Chart

```console
# Helm
$ helm install gitpod .
```

_See [configuration](#configuration) below._

_See [helm install](https://helm.sh/docs/helm/helm_install/) for command documentation._


## Dependencies

By default this chart installs additional, dependent charts:

- [stable/docker-registry](https://github.com/helm/charts/tree/master/stable/docker-registry)
- [stable/minio](https://github.com/minio/charts)
- [stable/mysql](https://github.com/helm/charts/tree/master/stable/mysql)

_See [configuration](#configuration) for options to replace those dependencies._

_See [helm dependency](https://helm.sh/docs/helm/helm_dependency/) for command documentation._


## Uninstall Chart

```console
# Helm
$ helm uninstall gitpod
```

This removes all the Kubernetes components associated with the chart and deletes the release.

_See [helm uninstall](https://helm.sh/docs/helm/helm_uninstall/) for command documentation._


## Upgrading Chart

```console
# Helm
$ helm upgrade --install gitpod .
```

_See [helm upgrade](https://helm.sh/docs/helm/helm_upgrade/) for command documentation._


## Recommended Configuration

The default installation of this Chart works out-of-the box in the majority of scenarios. The following section
introduces the most important options you likely want to review and tune for your particular use case.


### Ingress, Domain and HTTPS

| Parameter            | Description                                    | Default                                                 |
|----------------------|------------------------------------------------|---------------------------------------------------------|
| `ingressMode`        | One of `hosts`, `pathAndHost` and `noDomain`. Governs how workspaces are accessible. See [values.yaml](https://github.com/gitpod-io/gitpod/blob/master/chart/values.yaml) for details. | `noDomain`         |
| `hostname`           | The Hostname your installation is available at | `localhost`                                             |
| `certificatesSecret` | Configures certificates for your domain        | `{}`                                                    |

There are several options how to enable ingress into your Gitpod installation. They mostly hinge on the fact which kind of certificate are available:
 - `noDomain` requires no domain nor certificate but offers HTTP only
 - `hosts` enables all features and full HTTPS support but requires wilcard HTTPS certificates
 - `pathAndHost` is a tradeoff that works with non-wildcard HTTPS certificates
Compare [values.yaml](./values.yaml) for details.

For more details and a complete example using `hosts` see [here](https://www.gitpod.io/docs/self-hosted/latest/install/configure-ingress/).


### OAuth

#####TODO
 - dynamic vs static

See [here](https://www.gitpod.io/docs/self-hosted/latest/install/oauth/) on how to pre-configure OAuth providers.


### Database

The default installation comes with a MySQL that runs inside the same cluster.

#####TODO
See [here](https://www.gitpod.io/docs/self-hosted/latest/install/database/) on how to configure a custom database.


### Storage

#####TODO
See [here](https://www.gitpod.io/docs/self-hosted/latest/install/storage/) on how to configure a custom storage provider.


### Docker Registry

#####TODO
See [here](https://www.gitpod.io/docs/self-hosted/latest/install/docker-registry/) on how to configure a custom docker registry.


## Configuration Reference

 > Note: This is not complete yet and very much work-in-progress. Please [open an issue](https://github.com/gitpod-io/gitpod/issues/new?template=question.md) if you have a particular question!


### Kubernetes Nodes Configure file system layout and the workspace's node associativity.

### Workspace sizing

#####TODO
See [here](https://www.gitpod.io/docs/self-hosted/latest/install/workspaces/) on how to configure different workspace sizings.
