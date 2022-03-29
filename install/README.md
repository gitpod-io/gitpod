# Install

Resources for installing Gitpod

## Replicated/KOTS

Gitpod has teamed up with Replicated to simplify the installation of Gitpod for self-hosted users. This provides an installation interface, simplified license delivery for both community and paying users, easier upgrades and an improved support process.

Kubernetes Off-The-Shelf (KOTS) is the technology used to deliver and Replicated is the company behind it. The terms may be used interchangeably, but we will tend to talk of KOTS.

### Channels

> The `stable` channel should be used

The `stable` channel represents tested and validated releases. This will typically receive one update per month with each [milestone](https://github.com/gitpod-io/gitpod/milestones). Hotfixes may be released during the month where necessary.

The `beta` channel represents the release candidates for the `stable` channel. This will receive updates prior to a `stable` release ready for testing.

The `unstable` channel receives every release that is pushed to the `main` branch, typically receiving multiple updates per day.

#### Licenses

A license is required to install via KOTS. For a full list of features, please see our [docs](https://www.gitpod.io/self-hosted). To obtain a license for a paid subscription, please go to the [enterprise license](https://www.gitpod.io/enterprise-license) section of our docs.

Download the licenses below:

 - [Stable](./licenses/Community.yaml) _&#8592; recommended_
 - [Beta](./licenses/Community%20(Beta).yaml)
 - [Unstable](./licenses/Community%20(Unstable).yaml)

### Installation

#### Existing Cluster

```shell
curl https://kots.io/install | bash
kubectl kots install gitpod
```

For detailed instructions on the KOTS CLI, please see the [Replicated docs](https://docs.replicated.com/reference/kots-cli-getting-started).

#### Embedded Cluster

> Documentation coming soon

## Installer

For advanced users, the [Installer](./installer) is available.
