# Installs Gitpod!

# https://www.terraform.io/docs/providers/helm/r/release.html
resource "helm_release" "gitpod" {
  name          = "gitpod"
  repository    = var.helm.repository
  chart         = var.helm.chart
  recreate_pods = true
  wait          = true
  timeout       = 600
  # Is buggy: https://github.com/hashicorp/terraform-provider-helm/issues/405
  # see below for workaround
  #dependency_update = true

  values = flatten([
    data.template_file.gitpod_values_main.rendered,
    data.template_file.gitpod_values_auth_provider.rendered,
    [for path in var.gitpod.valueFiles : file(path)],
    var.values
  ])

  depends_on = [
    null_resource.helm_dependency_update
  ]
}

# Workaround for "helm_release.dependency_update" (see above) from https://github.com/hashicorp/terraform-provider-helm/issues/405#issuecomment-621910104
resource "null_resource" "helm_dependency_update" {
  provisioner "local-exec" {
    command = "helm dependency update ${var.helm.repository}${var.helm.chart}"
  }

  triggers = {
    always_run = "${timestamp()}"
  }
}

#
# Kubernetes Resources
#

# To get the external load balancer IP
# https://www.terraform.io/docs/providers/kubernetes/d/service.html
data "kubernetes_service" "proxy" {
  metadata {
    name      = "proxy"
    namespace = helm_release.gitpod.namespace
  }

  depends_on = [
    helm_release.gitpod
  ]
}
