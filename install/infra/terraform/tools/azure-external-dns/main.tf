variable settings {}
variable domain_name { default = "test"}
variable kubeconfig { default = "conf"}
variable txt_owner_id { default = "nightly-test"}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

# External DNS Deployment using Helm
resource "helm_release" "external_dns" {
  name             = "external-dns"
  repository       = "https://charts.bitnami.com"
  chart            = "external-dns"
  namespace        = "external-dns"
  create_namespace = true

  set {
    name  = "domainFilters[0]"
    value = var.domain_name
  }

  set {
    name  = "provider"
    value = "azure"
  }
  set {
    name  = "azure.userAssignedIdentityID"
    value = var.settings["azure.userAssignedIdentityID"]
  }

  set {
    name  = "azure.useManagedIdentityExtension"
    value = var.settings["azure.useManagedIdentityExtension"]
  }

  set {
    name  = "azure.tenantId"
    value = var.settings["azure.tenantId"]
  }

  set {
    name  = "azure.subscriptionId"
    value = var.settings["azure.subscriptionId"]
  }

  set {
    name  = "azure.resourceGroup"
    value = var.settings["azure.resourceGroup"]
  }

  set {
    name  = "txt-owner-id"
    value = var.txt_owner_id
  }
}
