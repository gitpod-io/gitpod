# Introduction to registry-facade

The container runtime consumes `registry-facade`.

Registry-facade modifies images as they are downloaded. It consults with `ws-manager` and adds layers in a certain order:

1. The base image for the workspace
2. supervisor
3. workspacekit
4. A DockerUp image
5. IDE
6. Desktop IDE

It also adds the `gp` cli to the workspace. Think of `registry-facade` as an image layer smuggler.

# Required Permssion

If you want it to work in a particular public cloud, you may need to grant some permissions.
Below is a reference for this.

## AWS IAM Policy

If you would like to use ECR as a container registry, please add the following IAM policy below.
Also, if you want to use ECR as public, you should add `ecr-public` too.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        }
    ]
}
```
