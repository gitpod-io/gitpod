
# the cluster_name should be of length less than 16 characters
cluster_name = "nan-cluster"

# a route53 zone and certificate request will be created for this domain
domain_name = "nan-cluster.gitpod-self-hosted.com"

region = "eu-west-1"

# make sure the cidr do not have any conflicts and will have IP ranges enough to split into 5 subnets
vpc_cidr = "10.100.0.0/16"

# should be atleast 2 zones
vpc_availability_zones = ["eu-west-1c", "eu-west-1b"]

# you can find the list of UBUNTU AMIs here corresponding to the k8s version and your region
# https://cloud-images.ubuntu.com/docs/aws/eks/
cluster_version = "1.22"
image_id = "ami-0793b4124359a6ad7"

enable_external_database = true
enable_external_storage  = true

# if you want to create a separate s3 bucket to use as registry backend,
# set the following to true. You can re-use the above bucket or incluster registry otherwise.
enable_external_storage_for_registry_backend  = false
