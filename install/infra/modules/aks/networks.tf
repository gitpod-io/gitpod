resource "azurerm_virtual_network" "network" {
  name                = format(local.name_format, local.location, "network")
  location            = azurerm_resource_group.gitpod.location
  resource_group_name = azurerm_resource_group.gitpod.name
  address_space       = ["10.2.0.0/16"]
}

resource "azurerm_subnet" "network" {
  name                 = format(local.name_format, local.location, "network")
  resource_group_name  = azurerm_resource_group.gitpod.name
  virtual_network_name = azurerm_virtual_network.network.name
  address_prefixes     = ["10.2.1.0/24"]
}

resource "azurerm_dns_zone" "dns" {
  count = var.dns_enabled ? 1 : 0

  name                = var.domain_name
  resource_group_name = azurerm_resource_group.gitpod.name
}
