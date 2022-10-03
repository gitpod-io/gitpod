# The resource should be of length less than 12 characters and surrounded by double quotes
# Make sure no such resource group exists
resource_group_name = "gp-${TF_VAR_TEST_ID}"

# a Azure cloud dns zone and certificate request will be created for this domain; surround the domain name within double quotes
domain_name = "${TF_VAR_TEST_ID}.${DOMAIN}"


location = "northeurope"

cluster_version = "1.22"

create_external_database = true
create_external_storage  = true
create_external_registry = true

kubeconfig = "${KUBECONFIG}"