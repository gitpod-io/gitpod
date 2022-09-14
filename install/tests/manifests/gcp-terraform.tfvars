# the cluster_name should be of length less than 15 characters and surrounded by double quotes
cluster_name = "gp-${TF_VAR_TEST_ID}"

# a cloudDNS zone and certificate request will be created for this domain; surround the domain name within double quotes
domain_name = "${TF_VAR_TEST_ID}.${DOMAIN}"

region      = "europe-west1"
zone        = "europe-west1-d"
project     = "sh-automated-tests"

cluster_version = "${CLUSTER_VERSION}"

enable_external_database = true
enable_external_storage  = true
enable_external_registry = true

kubeconfig = "${KUBECONFIG}"
