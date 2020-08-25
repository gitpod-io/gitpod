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
