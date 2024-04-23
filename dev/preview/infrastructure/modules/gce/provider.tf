terraform {
  required_version = ">= 1.2"

  required_providers {
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
