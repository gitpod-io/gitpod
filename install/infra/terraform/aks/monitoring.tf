resource "azurerm_log_analytics_workspace" "monitoring" {
  name                = format(var.name_format, var.location, "monitoring")
  location            = azurerm_resource_group.gitpod.location
  resource_group_name = azurerm_resource_group.gitpod.name
  sku                 = "PerGB2018"
}

resource "azurerm_log_analytics_solution" "monitoring" {
  solution_name         = "ContainerInsights"
  location              = azurerm_resource_group.gitpod.location
  resource_group_name   = azurerm_resource_group.gitpod.name
  workspace_name        = azurerm_log_analytics_workspace.monitoring.name
  workspace_resource_id = azurerm_log_analytics_workspace.monitoring.id

  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }
}
