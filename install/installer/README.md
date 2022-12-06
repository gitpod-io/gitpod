<p align="center">
  <a href="https://www.gitpod.io">
    <img src="https://raw.githubusercontent.com/gitpod-io/gitpod/master/components/dashboard/src/icons/gitpod.svg" height="60">
    <h3 align="center">Gitpod</h3>
  </a>
  <p align="center">Always ready-to-code.</p>
</p>

# Installer

The best way to get started with Gitpod is by using our recommended & default installation method [described in our documentation](https://www.gitpod.io/docs/self-hosted/latest/installing-gitpod). In fact, our default installation method actually wraps this installer into a UI that helps you manage, update and configure Gitpod in a streamlined way.

> The installer is an internal tool and as such not expected to be used by those external to Gitpod. Instructions for how to use it can be found in the [docs](https://github.com/gitpod-io/gitpod/tree/main/install/installer/docs/overview.md) folder of this repo.

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/from-referrer/)

## Configuration expectations

The [config](./pkg/config/) is the primary way that the installer can be interacted with. This guide details the expectations that users can have of the installer's configuration and the contract that it specifies.

### Versioning

The installer supports only one active version of the configuration at a given time.

#### Expectations for a version

The configuration for a version has the following expectations. If a constraint needs to be broken to support a new feature, this should trigger a new version of the configuration surface.

1. new parameters may be introduced
2. a parameter may have additional validation rules introduced
3. no parameter may be removed or renamed
4. sensitive data should always be included via a Kubernetes secret

Prior to deployment, a user should run the installer's `validation config` and `validation cluster` commands to ensure that the configuration is correct and the cluster is in a state to accept the deployment.

#### Introducing a new version

> At this stage, this is largely hypothetical as it has not yet been necessary to go beyond `v1`. This should be treated as the plan if-and-when it becomes necessary.

In the event that a [configuration expectation](#expectations-for-a-version) needs to be violated, a new version must be created. This should increment the `apiVersion` to the next integer (eg, from `v1` to `v2`), although this may change dependent upon the specific circumstances at the time.

There is a `config migrate` command that exists to convert the old configuration YAML to the new format.

#### Experimental config

> tl;dr here be dragons

As part of the configuration surface, there is an `experimental` feature. This is not designed to be used by the general public, but exists primarily for Gitpod-specific purposes or for those of our supported installations. The guarantees and expectations that exist for the main configuration surface do not exist for any parameter inside the `experimental` configuration and may be withdrawn or changed without notice.

A parameter may be promoted from `experimental` to the main configuration. In general, the previous `experimental` parameter must be marked as deprecated and should retained in the current state for a minimum of 3 months. This is to ensure that no supported deployments have any breaking changes introduced.
