# Terraform Module: kubernetes

This module installs the kubernetes cluster using the Google Kubernetes Engin (GKE).


## Input Variables

- `project`
- `location`: either the region or zone for the cluster
- `name`: the name of the kubernetes cluster, default: gitpod-cluster
- `network`: the name of the network the cluster is created in, the value is taken from the `network` module
- `subnets`: a list of the subnets created in the `network` module



## Output Variables

- `cluster`: returns the cluster resource including the connection details used by the helm and kubernets modules