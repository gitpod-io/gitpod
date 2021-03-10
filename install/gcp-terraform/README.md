# Gitpod installation on GCP using Terraform

## Prerequisites

### Terraform

Terraform is used to deploy the cloud infrastructure (https://terraform.io)

### GCP Project

To install Gitpod, a GCP project has to be present (https://support.google.com/googleapi/answer/6251787?hl=en).

### Registering a domain

The script creates an own DNS-Zone on GCP for Gitpod to avoid any interferences with other projects. If a subdomain is used an extra resource could create a domain delegation to the DNS-Zone created by the script.

If the parent domain is also hosted on GCP the resource looks like this:
```
resource "google_dns_record_set" "delegation" {
  name         = module.dns.zone.dns_name
  type         = "NS"
  ttl          = 300
  managed_zone = "<PARENT_DOMAIN>"
  rrdatas      = module.dns.zone.name_servers
  project      = "<PARENT_PROJECT_ID>"

  depends_on = [
    module.dns.done
  ]

}
```

A best practice would be to set up an extra GCP project (`PARENT_PROJECT_ID`) with a DNS-Zone managing the `PARENT_DOMAIN`.


### Terraform backend

If the Terraform deployment should be shared in a team it is useful to create a backend storing the Terraform state (https://www.terraform.io/docs/backends/index.html).

Therefore a Google storage bucket could used:
```
terraform {
  backend "gcs" {
    bucket  = "tf-state-prod"
    prefix  = "terraform/state"
  }
}
```
https://www.terraform.io/docs/backends/types/gcs.html

## Setup

A file has to be created to set every variable needed by the Terraform script, i.e. `project.auto.tfvars`. Using the ending `.auto.tfvars` the file is automatically recognized by Terraform.

```
certificate_email = <EMAIL>
gitpod_chart = <CHART_NAME or PATH_TO_CHART> # e.g. "/workspace/gitpod/chart"
gitpod_repository = <"null" for a local chart and "https://charts.gitpod.io" for the online repo>
gitpod_version = <GITPOD_VERSION>
location = <GCP location where the Kubernetes cluster shall be created>
project = <GCP_PROJECT_ID>
zone_name = <GCP_DNS_ZONE>
```
