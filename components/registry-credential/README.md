# registry-credential

`registry-credential` is a service for rotating the AWS ECR authorization token because the authorization token is valid for 12 hours.

## Development

### Prepare a Kubernetes cluster

```console
# Set up kube context. The registry-credential will connect to this Kubernetes cluster.
kubectx [cluster-name]
```

### Prepare the AWS access/secret key pair

```console
kubectl create secret generic aws-iam-credential \
    --from-literal=accessKeyId=<AWS_ACCESS_KEY> \
    --from-literal=secretAccessKey=<AWS_SECRET_KEY>
```

### Prepare the configuration

```json
{
  "namespace": "default", # The namespace to find the Kubernetes secret name
  "credentialSecret": "aws-iam-credential", # The secret name with AWS access/secret key pair
  "region": "", # The AWS ECR registry region
  "publicRegistry": false, # Indicate it's a private or public registry
  "secretToUpdate": "" # The authorization token written to
}
```

> **Note*
> If you are using public a AWS ECR registry, the region name is either `us-east-1` or `us-west-2`. Reference to the [AWS ECR Public endpoints](https://docs.aws.amazon.com/general/latest/gr/ecr-public.html).

### Running locally

To run `registry-credential` locally, the `example-config.json` can be used as follows:

```console
cd /workspace/gitpod/components/registry-credential

# Run registry-credential to update the AWS ECR authorization token.
go run . ecr-update example-config.json
```
