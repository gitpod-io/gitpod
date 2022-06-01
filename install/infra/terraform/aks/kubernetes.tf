data "azurerm_kubernetes_service_versions" "k8s" {
  location        = azurerm_resource_group.gitpod.location
  include_preview = false
}

resource "azurerm_role_assignment" "k8s" {
  count = var.dns_enabled ? 1 : 0

  principal_id         = azurerm_kubernetes_cluster.k8s.kubelet_identity[count.index].object_id
  role_definition_name = "DNS Zone Contributor"
  scope                = azurerm_dns_zone.dns[count.index].id
}

resource "azurerm_kubernetes_cluster" "k8s" {
  name                = format(var.name_format, local.location, "primary")
  location            = azurerm_resource_group.gitpod.location
  resource_group_name = azurerm_resource_group.gitpod.name
  dns_prefix          = "gitpod"

  kubernetes_version               = data.azurerm_kubernetes_service_versions.k8s.latest_version
  http_application_routing_enabled = false

  default_node_pool {
    name    = local.nodes.0.name
    vm_size = local.machine

    enable_auto_scaling  = true
    min_count            = 2
    max_count            = 10
    orchestrator_version = data.azurerm_kubernetes_service_versions.k8s.latest_version
    node_labels          = local.nodes.0.labels

    type           = "VirtualMachineScaleSets"
    vnet_subnet_id = azurerm_subnet.network.id
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "kubenet"
    network_policy = "calico"
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.monitoring.id
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "pools" {
  count = length(local.nodes) - 1

  kubernetes_cluster_id = azurerm_kubernetes_cluster.k8s.id
  name                  = local.nodes[count.index + 1].name
  vm_size               = local.machine

  enable_auto_scaling  = true
  min_count            = 2
  max_count            = 10
  orchestrator_version = data.azurerm_kubernetes_service_versions.k8s.latest_version
  node_labels          = local.nodes[count.index + 1].labels
  vnet_subnet_id       = azurerm_subnet.network.id
}

data "azurerm_resources" "k8s" {
  count = var.enable_airgapped ? 1 : 0

  resource_group_name = azurerm_kubernetes_cluster.k8s.node_resource_group
  type                = "Microsoft.Network/networkSecurityGroups"

  depends_on = [
    azurerm_kubernetes_cluster.k8s,
    azurerm_kubernetes_cluster_node_pool.pools
  ]
}

resource "azurerm_network_security_rule" "k8s" {
  count = length(local.network_security_rules)

  resource_group_name         = azurerm_kubernetes_cluster.k8s.node_resource_group
  network_security_group_name = data.azurerm_resources.k8s.0.resources.0.name

  priority  = lookup(local.network_security_rules[count.index], "priority", sum([100, count.index]))
  name      = local.network_security_rules[count.index].name
  access    = local.network_security_rules[count.index].access
  direction = local.network_security_rules[count.index].direction
  protocol  = local.network_security_rules[count.index].protocol

  description                = lookup(local.network_security_rules[count.index], "description", null)
  source_port_range          = lookup(local.network_security_rules[count.index], "source_port_range", null)
  destination_port_range     = lookup(local.network_security_rules[count.index], "destination_port_range", null)
  source_address_prefix      = lookup(local.network_security_rules[count.index], "source_address_prefix", null)
  destination_address_prefix = lookup(local.network_security_rules[count.index], "destination_address_prefix", null)
}
