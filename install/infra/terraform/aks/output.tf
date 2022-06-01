output "cert_manager_issuer" {
  value = try([{
    dns01 = {
      azureDNS = {
        subscriptionID    = data.azurerm_client_config.current.subscription_id
        resourceGroupName = azurerm_resource_group.gitpod.name
        hostedZoneName    = azurerm_dns_zone.dns.0.name
        managedIdentity = {
          clientID = azurerm_kubernetes_cluster.k8s.kubelet_identity.0.client_id
        }
      }
    }
  }], [])
}

output "cert_manager_secret" {
  value = {}
}

output "cluster_name" {
  value = azurerm_kubernetes_cluster.k8s.name
}

output "database" {
  sensitive = true
  value = try({
    host     = "${azurerm_mysql_server.db.0.name}.mysql.database.azure.com"
    password = azurerm_mysql_server.db.0.administrator_login_password
    port     = 3306
    username = "${azurerm_mysql_server.db.0.administrator_login}@${azurerm_mysql_server.db.0.name}"
  }, {})
}

output "domain_nameservers" {
  value = try(azurerm_dns_zone.dns.0.name_servers, null)
}

output "external_dns_secrets" {
  value = {}
}

output "external_dns_settings" {
  value = {
    provider                            = "azure"
    "azure.resourceGroup"               = azurerm_resource_group.gitpod.name
    "azure.subscriptionId"              = data.azurerm_client_config.current.subscription_id
    "azure.tenantId"                    = data.azurerm_client_config.current.tenant_id
    "azure.useManagedIdentityExtension" = true
    "azure.userAssignedIdentityID"      = azurerm_kubernetes_cluster.k8s.kubelet_identity.0.client_id
  }
}

output "k8s_connection" {
  sensitive = true
  value = {
    host                   = azurerm_kubernetes_cluster.k8s.kube_config.0.host
    username               = azurerm_kubernetes_cluster.k8s.kube_config.0.username
    password               = azurerm_kubernetes_cluster.k8s.kube_config.0.password
    client_certificate     = base64decode(azurerm_kubernetes_cluster.k8s.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.k8s.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.k8s.kube_config.0.cluster_ca_certificate)
  }
}

output "kubeconfig" {
  sensitive = true
  value     = azurerm_kubernetes_cluster.k8s.kube_config_raw
}

output "region" {
  value = var.location
}

output "registry" {
  sensitive = true
  value = try({
    server   = azurerm_container_registry.registry.0.login_server
    password = azurerm_container_registry.registry.0.admin_password
    username = azurerm_container_registry.registry.0.admin_username
  }, {})
}

output "storage" {
  sensitive = true
  value = try({
    username = azurerm_storage_account.storage.0.name
    password = azurerm_storage_account.storage.0.primary_access_key
  }, {})
}
