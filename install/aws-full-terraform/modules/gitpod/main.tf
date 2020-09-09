# Installs Gitpod!

# https://www.terraform.io/docs/providers/helm/r/release.html
resource "helm_release" "gitpod" {
  name              = "gitpod"
  repository        = var.helm.repository
  chart             = var.helm.chart
  recreate_pods     = true
  wait              = true
  timeout           = 600
  dependency_update = true

  values = flatten([
    data.template_file.gitpod_values_main.rendered,
    data.template_file.gitpod_values_auth_provider.rendered,
    [for path in var.gitpod.valueFiles : file(path)],
    var.values
  ])
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
