# refresh-credential

`refresh-credential` is a service to refresh the AWS ECR authorization token because the authorization token is valid for 12 hours.

## Development

### Prepare a Kubernetes cluster

```console
# Set up kube context. The refresh-credential will connect to this Kubernetes cluster.
kubectx [cluster-name]
```

### Prepare the AWS access/secret key pair

```console
aws configure
```

### Prepare the configuration

```json
{
  "namespace": "default", # The namespace to find the Kubernetes secret name
  "credentialSecret": "$HOME/.aws/credentials", # The secret name with AWS access/secret key pair
  "region": "", # The AWS ECR registry region
  "publicRegistry": false, # Indicate it's a private or public registry
  "secretToUpdate": "" # The authorization token written to
}
```

> **Note*
> If you are using public a AWS ECR registry, the region name is either `us-east-1` or `us-west-2`. Reference to the [AWS ECR Public endpoints](https://docs.aws.amazon.com/general/latest/gr/ecr-public.html).

### Running locally

To run `refresh-credential` locally, the `example-config.json` can be used as follows:

```console
cd /workspace/gitpod/components/refresh-credential

# Run refresh-credential to refresh the AWS ECR authorization token.
go run . ecr example-config.json
```
