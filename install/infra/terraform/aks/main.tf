terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0, < 4.0.0"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "gitpod" {
  name     = format(var.name_format_global, local.location)
  location = var.location
}

resource "local_file" "kubeconfig" {
  filename = var.kubeconfig
  content  = azurerm_kubernetes_cluster.k8s.kube_config_raw
}
