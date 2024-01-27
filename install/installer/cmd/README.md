# Cmd

Publicly available commands are part of our user contract. They use [Cobra](https://cobra.dev/) to build the Golang CLI commands.

## Commands

### config

These are designed to manipulate configuration files and generate a configuration file that can be used to install Gitpod.

#### init

> This replaces `init`, which is now deprecated

This should be run first. This will generate a new `gitpod.config.yaml` file with the default values configured.

#### build-from-envvars

This builds the config from environment variables.

#### cluster

Cluster commands are designed to deploy a Kubernetes resource to the cluster and generate the config value based upon the result. Typically (although not exclusively), these will be Jobs.

##### shiftfs

Detects whether ShiftFS is supported on the cluster for building images. If not, this will default to Fuse.

#### files

Files commands are designed to be run against the file structure. They may be run directly on the node, or by mounting the file system as a volume in a pod.

##### containerd

Detects the containerd settings for a cluster. This will return the location of the containerd socket and the path to the directory.
