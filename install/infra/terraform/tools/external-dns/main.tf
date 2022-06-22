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
  count            = var.settings == null ? 0 : 1
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
    name  = "txt-owner-id"
    value = var.txt_owner_id
  }

  dynamic "set" {
    for_each = var.settings
    iterator = setting
    content {
      name = setting.value["name"]
      value = setting.value["value"]
    }
  }
  # set {
  #   name  = "azure.userAssignedIdentityID"
  #   value = var.settings["azure.userAssignedIdentityID"]
  # }

  # set {
  #   name  = "azure.useManagedIdentityExtension"
  #   value = var.settings["azure.useManagedIdentityExtension"]
  # }

  # set {
  #   name  = "azure.tenantId"
  #   value = var.settings["azure.tenantId"]
  # }

  # set {
  #   name  = "azure.subscriptionId"
  #   value = var.settings["azure.subscriptionId"]
  # }

  # set {
  #   name  = "azure.resourceGroup"
  #   value = var.settings["azure.resourceGroup"]
  # }

  # TODO Add tags using dynamic block
  # https://github.com/hashicorp/terraform/issues/22340
  #  dynamic "set" {
  #    for_each = var.tags
  #    iterator = "tag"
  #    name     = "podLabels[${index(var.tags, tag.key)}]"
  #    value    = tag.value
  #  }
}
