terraform {
  backend "azurerm" {
    storage_account_name =
    container_name       =
    resource_group_name  =
    key = "gitpod"

    use_azuread_auth     = true
  }
}
