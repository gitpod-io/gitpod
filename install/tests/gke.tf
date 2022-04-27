module "gke" {
  source = "../infra/terraform/gke"
  project_id         = "nvn-self-hosted-playground"
  region             = "europe-west1"
  name               = "gitpod-test"
  machine_type       = "n2-standard-4"
  min_count          = 1
  max_count          = 4
  disk_size_gb       = 100
  service_account    = "gitpod-k3s@nvn-self-hosted-playground.iam.gserviceaccount.com"
  initial_node_count = 1
}

locals {
  token = module.gke.client_token
  cluster_ca_certificate = module.gke.ca_certificate
  endpoint = module.gke.kubernetes_endpoint
}

output "kubernetes_endpoint" {
  sensitive = true
  value = module.gke.kubernetes_endpoint
  description = "Endpoint of the cluster"
}

output "kubeconfig" {
  sensitive = true
  value = module.gke.kubeconfig_raw
  description = "Raw Kubeconfig value"
}
