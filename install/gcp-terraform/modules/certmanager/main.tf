/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

resource "random_id" "certmanager" {
  byte_length = 4
}

#
resource "google_service_account" "certmanager" {
  account_id   = "${var.certmanager.name}-${random_id.certmanager.hex}"
  display_name = "${var.certmanager.name}-${random_id.certmanager.hex}"
  description  = "Cert-Manager Account ${var.certmanager.name}"
  project      = var.project
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_iam#google_project_iam_member
resource "google_project_iam_member" "project" {
  project = var.project
  role    = "roles/dns.admin"
  member  = "serviceAccount:${google_service_account.certmanager.email}"
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account_key
resource "google_service_account_key" "certmanager" {
  service_account_id = google_service_account.certmanager.name
}


#
# Kubernetes Resources
#

resource "kubernetes_namespace" "certmanager" {
  provider = kubernetes
  metadata {
    name = var.certmanager.namespace
  }
}

#
resource "kubernetes_secret" "certmanager" {
  provider = kubernetes
  metadata {
    name      = "clouddns-dns01-solver-svc-acct"
    namespace = kubernetes_namespace.certmanager.metadata[0].name
  }
  data = {
    "credentials.json" = base64decode(google_service_account_key.certmanager.private_key)
  }
}


# https://registry.terraform.io/providers/hashicorp/helm/latest/docs/resources/release
resource "helm_release" "certmanager" {
  name       = var.certmanager.name
  chart      = var.certmanager.chart
  repository = var.certmanager.repository

  namespace        = kubernetes_namespace.certmanager.metadata[0].name
  create_namespace = false

  wait = true

  set {
    name  = "installCRDs"
    value = var.certmanager.crds
  }
}

# https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep
# waits for CRDS to be installed
resource "time_sleep" "certmanager" {
  create_duration = "300s"

  depends_on = [
    helm_release.certmanager
  ]
}

locals {
  clusterissuer = {
    name     = "letsencrypt-issuer"
    key_name = "letsencrypt-private-key"
  }
}

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "cluster_issuer" {
  template = file("${path.module}/templates/clusterissuer.tpl")

  vars = {
    name        = local.clusterissuer.name
    email       = var.email
    project     = var.project
    key_name    = local.clusterissuer.key_name
    secret_name = kubernetes_secret.certmanager.metadata[0].name
  }
}

# https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file
resource "kubectl_manifest" "clusterissuer" {
  provider  = kubectl
  yaml_body = data.template_file.cluster_issuer.rendered

  depends_on = [
    time_sleep.certmanager
  ]
}

locals {
  shortname = trimsuffix("ws-${var.shortname}", "-")
}

# https://registry.terraform.io/providers/hashicorp/template/latest/docs/data-sources/file
data "template_file" "certificate" {
  template = file("${path.module}/templates/certificate.tpl")

  vars = {
    name      = var.certificate.name
    namespace = var.certificate.namespace
    domain    = var.domain
    shortname = local.shortname
  }
}

# https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file
resource "kubectl_manifest" "certificate" {
  provider  = kubectl
  yaml_body = data.template_file.certificate.rendered

  depends_on = [
    kubectl_manifest.clusterissuer
  ]
}


data "template_file" "values" {
  template = file("${path.module}/templates/values.tpl")

  vars = {
    secret_name     = var.certificate.name
    key_name        = "tls.key"
    chain_name      = "tls.crt"
    full_chain_name = "tls.crt"
  }
}