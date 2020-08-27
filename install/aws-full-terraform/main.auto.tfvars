# (Optional) We Use this variable to name resources
project = {
  name = "your-project"
}

# (Optional) Gitpod install values
gitpod = {
  # What namespace should Gitpod be installed into? (Namespace is creaed if does not exist)
  namespace = "default"
  # Place any additional values in this file
  valueFiles = ["./values.yml"]
}

dns = {
  # What (sub)domain should Gitpod be installed into.
  domain = "your-domain.com"
  # Name of the **Existing** Hosted zone with your domain configured
  zone_name = "your-domain.com."
}

kubernetes = {
  # Name of the Kubernetes Cluster Terraform should create
  cluster_name = "gitpod-cluster"
  # The Cluster's desired Kubernetes Version
  version = "1.16"
  # How many worker nodes the Cluster should have
  node_count = 6
  # How large the Worker nodes should be
  instance_type = "m4.large"
  # Your Home directory where the kubeconfig should be created
  home_dir = "/home/gitpod"
}

# (Optional) The configuration of your AWS profile
aws = {
  region  = "us-east-2"
  profile = "default"
}

# (Optional) MySQL Configuration
database = {
  name           = "db"
  port           = 3306
  instance_class = "db.t2.micro"
  engine_version = "5.7.26"
  user_name      = "gitpod"
  password       = "DB-PASSWORD"
}

# The configuration of your **EXISTING** OAuth Appliaton
auth_providers = [
  {
    id            = "Github"
    host          = "github.com"
    client_id     = "<CLIENT_ID>"
    client_secret = "<CLIENT_SECRET>"
    settings_url  = "https://github.com/settings/connections/applications/<CLIENT_ID>"
    callback_url  = "https://your-domain.com/auth/github/callback"
    type          = "GitHub"
    protocol      = "https"
  }
]

# (Optional) VPC configurtion
vpc = {
  # Name of the VPC you want to make
  name = "gitpod-network"
}

# Configure cert-manager
cert_manager = {
  # Name of the cert-manager chart (you likely won't need to change this)
  chart = "cert-manager"
  # Email Address associated with the ACME account created
  email = "you@example.com"
  # Namespace where cert-manager should be installed (namespace will be created if it doesn't exist)
  namespace = "cert-manager"
}
