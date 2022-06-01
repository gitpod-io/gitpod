locals {
  labels = tomap({
    workload_meta : "gitpod.io/workload_meta"
    workload_ide : "gitpod.io/workload_ide"
    workspace_services : "gitpod.io/workload_workspace_services"
    workspace_regular : "gitpod.io/workload_workspace_regular"
    workspace_headless : "gitpod.io/workload_workspace_headless"
  })
  dns_enabled = var.domain_name != null
  name_format = join("-", [
    "gitpod",
    "%s", # region
    "%s", # name
    local.workspace_name
  ])
  name_format_global = join("-", [
    "gitpod",
    "%s", # name
    local.workspace_name
  ])
  workspace_name = replace(terraform.workspace, "/[\\W\\-]/", "") # alphanumeric workspace name
  db       = "GP_Gen5_2"
  location = substr(var.location, 0, 3) # Short code for location
  machine  = "Standard_D4_v3"
  network_security_rules = var.enable_airgapped ? [
    {
      name                       = "AllowContainerRegistry"
      description                = "Allow outgoing traffic to the container registry"
      direction                  = "Outbound"
      access                     = "Allow"
      protocol                   = "*"
      source_port_range          = "*"
      destination_port_range     = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "AzureContainerRegistry"
    },
    {
      name                       = "AllowDatabase"
      description                = "Allow outgoing traffic to the database"
      direction                  = "Outbound"
      access                     = "Allow"
      protocol                   = "*"
      source_port_range          = "*"
      destination_port_range     = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "Sql"
    },
    {
      name                       = "AllowStorage"
      description                = "Allow outgoing traffic to the storage"
      direction                  = "Outbound"
      access                     = "Allow"
      protocol                   = "*"
      source_port_range          = "*"
      destination_port_range     = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "Storage"
    },
    {
      name                       = "AllowAzureCloud"
      description                = "Allow outgoing traffic to the Azure cloud"
      direction                  = "Outbound"
      access                     = "Allow"
      protocol                   = "*"
      source_port_range          = "*"
      destination_port_range     = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "AzureCloud"
    },
    {
      name                       = "DenyInternetOutBound"
      description                = "Deny outgoing traffic to the public internet"
      direction                  = "Outbound"
      access                     = "Deny"
      protocol                   = "*"
      source_port_range          = "*"
      destination_port_range     = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "Internet"
      priority                   = 4096
    }
  ] : []
  nodes = [
    {
      name = "services"
       labels = {
        lookup(local.labels, "workload_meta")      = true
        lookup(local.labels, "workload_ide")       = true
        lookup(local.labels, "workspace_services") = true
        lookup(local.labels, "workspace_regular")  = true
        lookup(local.labels, "workspace_headless") = true
      }
    }
  ]
}
