# the cluster_name should be of length less than 15 characters and surrounded by double quotes
cluster_name = "gp-${TF_VAR_TEST_ID}"

# a route53 zone and certificate request will be created for this domain; surround the domain name within double quotes
domain_name = "${TF_VAR_TEST_ID}.${DOMAIN}"

region = "eu-west-1"

# make sure the cidr do not have any conflicts and will have IP ranges enough to split into 5 subnets
vpc_cidr = "10.100.0.0/16"

# should be atleast 2 zones
vpc_availability_zones = ["eu-west-1c", "eu-west-1b"]

# !important!: You need to make sure the image_id below matches your region.
# You can find the list of UBUNTU AMIs here corresponding to the k8s version and your region via
# https://cloud-images.ubuntu.com/docs/aws/eks/
cluster_version = "${CLUSTER_VERSION}"

image_id = "${IMAGE_ID}"

create_external_database = true
create_external_storage  = true

# if you want to create a separate s3 bucket to use as registry backend,
# set the following to true. You can re-use the above bucket or incluster registry otherwise.
create_external_storage_for_registry_backend = false

kubeconfig = "${KUBECONFIG}"
