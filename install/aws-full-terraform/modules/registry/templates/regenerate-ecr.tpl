#!/bin/bash

# Set the AWS auth environment variables
AWS_DEFAULT_REGION=${region}
AWS_SECRET_ACCESS_KEY=${secret_key}
AWS_ACCESS_KEY_ID=${access_key}

# Generate the auth token from the aws account 
TOKEN=`aws ecr get-authorization-token --output text --query 'authorizationData[].authorizationToken'`

# Delete the original secret
kubectl delete secret --ignore-not-found ${secret_name}

# Generate the new docker registry auth config
CONFIGJSON='{"auths": {"%s": {"auth": "%s"}}}\n'
UPDATEDCONFIG=$(printf "$CONFIGJSON" "${host}" "$TOKEN")
echo $UPDATEDCONFIG > /tmp/config.json

# Create a new kubernetes secret with the updated auth token
kubectl create secret generic ${secret_name} \
    --from-file=.dockerconfigjson=/tmp/config.json \
    --type=kubernetes.io/dockerconfigjson

# Update the default service account
kubectl patch serviceaccount default -p '{"imagePullSecrets":[{"name":"'${secret_name}'"}]}'

echo "Token regeneration complete"