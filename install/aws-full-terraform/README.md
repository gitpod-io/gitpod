# Gitpod AWS Terraform

1. Create S3 Bucket for remote state
2. Configure a Route 53 Hosted zone to your domain
3. Configure `backend.hcl` to match the S3 Bucket
4. Fill out `main.auto.tfvars` to match what you want (and put in the name of the hosted zone where required)
5. (Optional) configure any additional helm values in the values.yml file
6. Run `make init`
7. Run `make apply`
8. Confirm the plan
9. Go get coffee (this could take a while)
10. Come back, if its done then go to the domain you specified in the tfvars file and play with your new configuration

# FAQ
## Q: I get "OptInRequired: You are not subscribed to this service. Please go to http://aws.amazon.com to subscribe."
  A: Your account seems to be missing a credit card. Go to https://portal.aws.amazon.com/billing/signup?type=resubscribe#/resubscribed and finish the subscription process.

## Q: I get "Status Reason: The requested configuration is currently not supported"
  A: Switch to another [AWS region](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html) often helps. Some machines are not available in all regions.

## Q: I get "Error: Service "proxy" is invalid: spec.ports[0].nodePort: Invalid value: 31080: provided port is already allocated" on re-applying the terraform script
  A: Wait 2-5mins (cmp. Kubernetes issues [32987](https://github.com/kubernetes/kubernetes/issues/32987) and [73140](https://github.com/kubernetes/kubernetes/issues/73140))

## Q: One of my pods throws errors reading "networkPlugin cni failed to set up pod "<name>" network: add cmd: failed to assign an IP address to container"
  A: Seems like the pod-per-node limit is reached: https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt (?)