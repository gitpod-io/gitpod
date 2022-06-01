resource "random_integer" "registry" {
  count = var.enable_external_registry ? 1 : 0

  min = 10000
  max = 99999
}

resource "azurerm_container_registry" "registry" {
  count = var.enable_external_registry ? 1 : 0

  name                = "gitpod${random_integer.registry[count.index].result}"
  resource_group_name = azurerm_resource_group.gitpod.name
  location            = azurerm_resource_group.gitpod.location
  admin_enabled       = true
  sku                 = "Premium"
}

resource "azurerm_role_assignment" "registry" {
  count = var.enable_external_registry ? 1 : 0

  principal_id                     = azurerm_kubernetes_cluster.k8s.kubelet_identity[0].object_id
  role_definition_name             = "AcrPush"
  scope                            = azurerm_container_registry.registry[count.index].id
  skip_service_principal_aad_check = true
}
