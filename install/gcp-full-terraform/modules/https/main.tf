/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# GCP Resources
#

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/id
resource "random_id" "cert_manager" {
  byte_length = 1
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account
resource "google_service_account" "cert_manager" {
  account_id   = "cert-manager-${random_id.cert_manager.hex}"
  display_name = "${var.project} Cert-Manager"
  description  = "${var.project} Cert-Manager Account"
  project      = var.project
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_iam#google_project_iam_member
resource "google_project_iam_member" "project" {
  project = var.project
  role    = "roles/dns.admin"
  member  = "serviceAccount:${google_service_account.cert_manager.email}"
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account_key
resource "google_service_account_key" "cert_manager" {
  service_account_id = google_service_account.cert_manager.name
}


#
# Kubernetes Resources
#

# https://registry.terraform.io/providers/hashicorp/helm/latest/docs/resources/release
resource "helm_release" "cert_manager" {
  name       = var.cert_manager.name
  chart      = var.cert_manager.chart
  repository = var.cert_manager.repository

  namespace        = var.cert_manager.namespace
  create_namespace = true

  wait = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [
    var.requirements
  ]

}

# https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/secret
resource "kubernetes_secret" "cert_manager" {
  metadata {
    name      = "clouddns-dns01-solver-svc-acct"
    namespace = var.cert_manager.namespace
  }

  data = {
    "key.json" = base64decode(google_service_account_key.cert_manager.private_key)
  }

  depends_on = [
    helm_release.cert_manager
  ]

}

# https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
resource "random_password" "cert_manager_secret" {
  length  = 32
  special = false
}


# https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep
resource "time_sleep" "cert_manager" {
  create_duration = "300s"
  depends_on = [
    helm_release.cert_manager
  ]
}


#
# Cluster Issuer
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "cluster_issuer" {
  template = file("${path.module}/templates/cert-manager_cluster-issuer.tpl")
  vars = {
    email   = var.certificate_email
    project = var.project
  }
}

# https://registry.terraform.io/providers/mildred/null/latest/docs/resources/null_resource
resource "null_resource" "cert_manager_cluster_issuer" {

  provisioner "local-exec" {
    command = "KUBECONFIG=${path.root}/secrets/kubeconfig kubectl apply --validate=false -f -<<EOF\n${data.template_file.cluster_issuer.rendered}\nEOF"
  }

  depends_on = [
    kubernetes_secret.cert_manager,
    time_sleep.cert_manager
  ]
}



#
# Certificate
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "certificate" {
  template = file("${path.module}/templates/cert-manager_certificate.tpl")
  vars = {
    secretName = "proxy-config-certificates"
    dns_zone  = trimsuffix(var.dns_name, ".")
    namespace = var.gitpod.namespace
  }
}

# https://registry.terraform.io/providers/mildred/null/latest/docs/resources/null_resource
resource "null_resource" "cert_manager_certificate" {
  provisioner "local-exec" {
    command = "kubectl apply --kubeconfig ${path.root}/secrets/kubeconfig --validate=false -f -<<EOF\n${data.template_file.certificate.rendered}\nEOF"
  }
  depends_on = [
    null_resource.cert_manager_cluster_issuer
  ]
}





#
# values.yaml
#

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "gitpod_https_values" {
  template = file("${path.module}/templates/values.tpl")
  vars = {
    secretName = "proxy-config-certificates"
    fullChainName = "tls.crt"
    chainName = "tls.crt"
    keyName = "tls.key"
  }
}





#
# End
#

# https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep
resource "time_sleep" "cert_manager_done" {
  create_duration = "300s"
  depends_on = [
    null_resource.cert_manager_certificate
  ]
}

resource "null_resource" "done" {
  depends_on = [
    time_sleep.cert_manager_done
  ]
}
