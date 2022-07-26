# the cluster_name should be of length less than 16 characters
cluster_name = "nan-cluster"

# a cloudDNS zone and certificate request will be created for this domain
domain_name = "nan-cluster.gitpod-self-hosted.com"

region      = "europe-west1"
zone        = "europe-west1-d"
project     = "my-gcp-project"
credentials = "/path/to/account/key.json"

cluster_version = "1.22"

enable_external_database = true
enable_external_storage  = true
enable_external_registry = true
