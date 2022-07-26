module "gke" {
  source = "../../modules/gke"

  name            = "gitpod-cluster"
  kubeconfig      = "./kubeconfig"
  cluster_version = "1.23"
  project         = "sh-automated-tests"
  region          = "europe-west1"
  zone            = "europe-west1-d" # remove this to create a regional cluster

  domain_name     = "tests-gcp-tf.gitpod-self-hosted.com"
}
