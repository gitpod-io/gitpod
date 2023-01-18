resource "azurerm_role_assignment" "k8s" {
  count = local.dns_enabled ? 1 : 0

  principal_id         = azurerm_kubernetes_cluster.k8s.kubelet_identity[count.index].object_id
  role_definition_name = "DNS Zone Contributor"
  scope                = azurerm_dns_zone.dns[count.index].id
}

resource "azurerm_role_assignment" "k8s_reader" {
  count = local.dns_enabled ? 1 : 0

  principal_id         = azurerm_kubernetes_cluster.k8s.kubelet_identity[count.index].object_id
  role_definition_name = "Reader"
  scope                = azurerm_dns_zone.dns[count.index].id
}

resource "azurerm_kubernetes_cluster" "k8s" {
  name                            = format(local.name_format, "cluster")
  location                        = azurerm_resource_group.gitpod.location
  resource_group_name             = azurerm_resource_group.gitpod.name
  dns_prefix                      = "gitpod"
  tags                            = {}
  api_server_authorized_ip_ranges = []

  kubernetes_version               = var.cluster_version
  http_application_routing_enabled = false

  default_node_pool {
    name    = "services"
    vm_size = var.services_machine_type


    node_taints = []
    tags        = {}
    zones       = []

    enable_auto_scaling  = true
    min_count            = 1
    max_count            = var.max_node_count_services
    orchestrator_version = var.cluster_version
    node_labels = {
      "gitpod.io/workload_meta"               = true
      "gitpod.io/workload_ide"                = true
      "gitpod.io/workload_workspace_services" = true
      "gitpod.io/workload_services"           = true
    }

    type           = "VirtualMachineScaleSets"
    vnet_subnet_id = azurerm_subnet.network.id
  }

  identity {
    type         = "SystemAssigned"
    identity_ids = []
  }

  network_profile {
    network_plugin = "kubenet"
    network_policy = "calico"
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.monitoring.id
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "regularws" {
  kubernetes_cluster_id = azurerm_kubernetes_cluster.k8s.id
  name                  = "regularws"
  vm_size               = var.workspaces_machine_type

  enable_auto_scaling  = true
  min_count            = 1
  max_count            = var.max_node_count_regular_workspaces
  orchestrator_version = var.cluster_version
  node_labels          = { "gitpod.io/workload_workspace_regular" = true }
  vnet_subnet_id       = azurerm_subnet.network.id
}

resource "azurerm_kubernetes_cluster_node_pool" "headlessws" {
  kubernetes_cluster_id = azurerm_kubernetes_cluster.k8s.id
  name                  = "headlessws"
  vm_size               = var.workspaces_machine_type

  enable_auto_scaling  = true
  min_count            = 1
  max_count            = var.max_node_count_headless_workspaces
  orchestrator_version = var.cluster_version
  node_labels          = { "gitpod.io/workload_workspace_headless" = true }
  vnet_subnet_id       = azurerm_subnet.network.id
}

data "azurerm_resources" "k8s" {
  count = var.enable_airgapped ? 1 : 0

  resource_group_name = azurerm_kubernetes_cluster.k8s.node_resource_group
  type                = "Microsoft.Network/networkSecurityGroups"

  depends_on = [
    azurerm_kubernetes_cluster.k8s,
    azurerm_kubernetes_cluster_node_pool.regularws,
    azurerm_kubernetes_cluster_node_pool.headlessws,
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

resource "local_file" "kubeconfig" {
  depends_on = [
    resource.azurerm_kubernetes_cluster_node_pool.regularws,
    resource.azurerm_kubernetes_cluster_node_pool.headlessws,
  ]
  filename = var.kubeconfig
  content  = azurerm_kubernetes_cluster.k8s.kube_config_raw
  lifecycle {
    create_before_destroy = true
  }
}
