resource "random_integer" "db" {
  count = var.enable_external_database ? 1 : 0

  min = 10000
  max = 99999
}

resource "random_password" "db" {
  count = var.enable_external_database ? 1 : 0

  length = 32
}

resource "azurerm_mysql_server" "db" {
  count = var.enable_external_database ? 1 : 0

  name                = "gitpod-${random_integer.db[count.index].result}"
  location            = azurerm_resource_group.gitpod.location
  resource_group_name = azurerm_resource_group.gitpod.name

  sku_name                         = local.db
  storage_mb                       = 20480
  ssl_enforcement_enabled          = false
  ssl_minimal_tls_version_enforced = "TLSEnforcementDisabled"
  version                          = "5.7"

  auto_grow_enabled            = true
  administrator_login          = "gitpod"
  administrator_login_password = random_password.db[count.index].result
}

resource "azurerm_mysql_firewall_rule" "db" {
  count = var.enable_external_database ? 1 : 0

  name                = "Azure_Resource"
  resource_group_name = azurerm_resource_group.gitpod.name
  server_name         = azurerm_mysql_server.db[count.index].name
  start_ip_address    = "0.0.0.0"
  end_ip_address      = "0.0.0.0"
}

resource "azurerm_mysql_database" "db" {
  count = var.enable_external_database ? 1 : 0

  name                = "gitpod"
  resource_group_name = azurerm_resource_group.gitpod.name
  server_name         = azurerm_mysql_server.db[count.index].name
  charset             = "utf8"
  collation           = "utf8_unicode_ci"
}
