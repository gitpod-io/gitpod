resource "random_integer" "storage" {
  count = var.enable_external_storage ? 1 : 0

  min = 10000
  max = 99999
}

resource "azurerm_storage_account" "storage" {
  count = var.enable_external_storage ? 1 : 0

  name                     = "gitpod${random_integer.storage[count.index].result}"
  resource_group_name      = azurerm_resource_group.gitpod.name
  location                 = azurerm_resource_group.gitpod.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
