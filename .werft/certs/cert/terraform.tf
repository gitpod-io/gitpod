terraform {
  required_providers = {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = ">= 1.7.0"
      configuration_aliases = [ kubectl.target-cluster ]
    }
  }
}