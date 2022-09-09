# the cluster_name should be of length less than 15 characters and surrounded by double quotes
name = "gp-${TF_VAR_TEST_ID}"

# a cloudDNS zone and certificate request will be created for this domain; surround the domain name within double quotes
domain_name = "${TF_VAR_TEST_ID}.${DOMAIN}"

region      = "europe-west1"
zone        = "europe-west1-b"
project     = "sh-automated-tests"
credentials = "${GOOGLE_APPLICATION_CREDENTIALS}"

cluster_version = "${CLUSTER_VERSION}"

image_id = "${UBUNTU_IMAGE}"

kubeconfig = "${KUBECONFIG}"

managed_dns_zone = "sh-tests-gitpod-self-hosted-com"
