# Azure

Azure provider for Gitpod testing

<!-- toc -->

- [Terraform Documentation](#terraform-documentation)
  * [Requirements](#requirements)
  * [Providers](#providers)
  * [Modules](#modules)
  * [Resources](#resources)
  * [Inputs](#inputs)
  * [Outputs](#outputs)

<!-- tocstop -->

# Terraform Documentation

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | >= 3.0.0, < 4.0.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | >= 3.0.0, < 4.0.0 |
| <a name="provider_random"></a> [random](#provider\_random) | n/a |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [azurerm_container_registry.registry](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/container_registry) | resource |
| [azurerm_dns_zone.dns](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/dns_zone) | resource |
| [azurerm_kubernetes_cluster.k8s](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/kubernetes_cluster) | resource |
| [azurerm_kubernetes_cluster_node_pool.pools](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/kubernetes_cluster_node_pool) | resource |
| [azurerm_log_analytics_solution.monitoring](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/log_analytics_solution) | resource |
| [azurerm_log_analytics_workspace.monitoring](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/log_analytics_workspace) | resource |
| [azurerm_mysql_database.db](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/mysql_database) | resource |
| [azurerm_mysql_firewall_rule.db](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/mysql_firewall_rule) | resource |
| [azurerm_mysql_server.db](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/mysql_server) | resource |
| [azurerm_network_security_rule.k8s](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/network_security_rule) | resource |
| [azurerm_resource_group.gitpod](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_role_assignment.k8s](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_role_assignment.registry](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_storage_account.storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_account) | resource |
| [azurerm_subnet.network](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/subnet) | resource |
| [azurerm_virtual_network.network](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network) | resource |
| [random_integer.db](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/integer) | resource |
| [random_integer.registry](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/integer) | resource |
| [random_integer.storage](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/integer) | resource |
| [random_password.db](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password) | resource |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config) | data source |
| [azurerm_kubernetes_service_versions.k8s](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/kubernetes_service_versions) | data source |
| [azurerm_resources.k8s](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resources) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_dns_enabled"></a> [dns\_enabled](#input\_dns\_enabled) | Common variables | `any` | n/a | yes |
| <a name="input_domain_name"></a> [domain\_name](#input\_domain\_name) | n/a | `any` | n/a | yes |
| <a name="input_enable_airgapped"></a> [enable\_airgapped](#input\_enable\_airgapped) | n/a | `any` | n/a | yes |
| <a name="input_enable_external_database"></a> [enable\_external\_database](#input\_enable\_external\_database) | n/a | `any` | n/a | yes |
| <a name="input_enable_external_registry"></a> [enable\_external\_registry](#input\_enable\_external\_registry) | n/a | `any` | n/a | yes |
| <a name="input_enable_external_storage"></a> [enable\_external\_storage](#input\_enable\_external\_storage) | n/a | `any` | n/a | yes |
| <a name="input_labels"></a> [labels](#input\_labels) | n/a | `any` | n/a | yes |
| <a name="input_location"></a> [location](#input\_location) | Azure-specific variables | `any` | n/a | yes |
| <a name="input_name_format"></a> [name\_format](#input\_name\_format) | n/a | `any` | n/a | yes |
| <a name="input_name_format_global"></a> [name\_format\_global](#input\_name\_format\_global) | n/a | `any` | n/a | yes |
| <a name="input_workspace_name"></a> [workspace\_name](#input\_workspace\_name) | n/a | `any` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_cert_manager_issuer"></a> [cert\_manager\_issuer](#output\_cert\_manager\_issuer) | n/a |
| <a name="output_cert_manager_secret"></a> [cert\_manager\_secret](#output\_cert\_manager\_secret) | n/a |
| <a name="output_cluster_name"></a> [cluster\_name](#output\_cluster\_name) | n/a |
| <a name="output_database"></a> [database](#output\_database) | n/a |
| <a name="output_domain_nameservers"></a> [domain\_nameservers](#output\_domain\_nameservers) | n/a |
| <a name="output_external_dns_secrets"></a> [external\_dns\_secrets](#output\_external\_dns\_secrets) | n/a |
| <a name="output_external_dns_settings"></a> [external\_dns\_settings](#output\_external\_dns\_settings) | n/a |
| <a name="output_k8s_connection"></a> [k8s\_connection](#output\_k8s\_connection) | n/a |
| <a name="output_kubeconfig"></a> [kubeconfig](#output\_kubeconfig) | n/a |
| <a name="output_region"></a> [region](#output\_region) | n/a |
| <a name="output_registry"></a> [registry](#output\_registry) | n/a |
| <a name="output_storage"></a> [storage](#output\_storage) | n/a |
<!-- END_TF_DOCS -->
