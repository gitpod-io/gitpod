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
