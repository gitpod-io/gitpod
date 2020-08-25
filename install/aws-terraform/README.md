  1. login to [AWS](https://console.aws.amazon.com/console/home)
    1. obtain and export AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY following this guide: https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html
  
  1. open `main.auto.tfvars` and configure:
    1. `domain`: the domain you want gitpod to run on
    1. `region`: the [AWS region](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html) the cluster should be created in
  1. terraform plan
  1. terraform apply (may take up to 15mins to create all resources and deploy Gitpod on the first run)


# FAQ
## Q: I get "OptInRequired: You are not subscribed to this service. Please go to http://aws.amazon.com to subscribe."
  A: Your account seems to be missing a credit card. Go to https://portal.aws.amazon.com/billing/signup?type=resubscribe#/resubscribed and finish the subscription process.

## Q: I get "Status Reason: The requested configuration is currently not supported"
  A: Switch to another [AWS region](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html) often helps. Some machines are not available in all regions.

## Q: I get "Error: Service "proxy" is invalid: spec.ports[0].nodePort: Invalid value: 31080: provided port is already allocated" on re-applying the terraform script
  A: Wait 2-5mins (cmp. Kubernetes issues [32987](https://github.com/kubernetes/kubernetes/issues/32987) and [73140](https://github.com/kubernetes/kubernetes/issues/73140))

## Q: One of my pods throws errors reading "networkPlugin cni failed to set up pod "<name>" network: add cmd: failed to assign an IP address to container"
  A: Seems like the pod-per-node limit is reached: https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt (?)