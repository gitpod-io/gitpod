terraform {
  required_version = ">= 1.2"

  required_providers {
    harvester = {
      source                = "harvester/harvester"
      version               = "=0.5.3"
      configuration_aliases = [harvester.harvester]
    }
    k8s = {
      source                = "hashicorp/kubernetes"
      version               = ">= 2.0"
      configuration_aliases = [k8s.dev, k8s.harvester]
    }
    google = {
      source                = "hashicorp/google"
      version               = ">=4.40.0"
      configuration_aliases = [google]
    }
    acme = {
      source                = "vancluever/acme"
      version               = "~> 2.0"
      configuration_aliases = [acme.letsencrypt, acme.zerossl]
    }
  }
}
