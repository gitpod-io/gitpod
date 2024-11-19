# Introduction to image-builder-bob

## Overview

Bob is a CLI responsible for building and pushing workspace images during workspace startup.

For each image build, a headless workspace gets created in the workspace cluster by `image-builder-mk3` in this headless workspace runs:
- `bob proxy`, which gets started by workspacekit in ring1, and receives credentials for pushing images to a docker registry. It proxies and authenticates the image pushes from `bob build`.
- `bob build` as a workspace task, which builds the
  - **base layer**, if a custom Dockerfile is specified in `.gitpod.yaml`. If this base image has already been built for the workspace, this step is skipped, and the reference of the previously built image is used instead to build the workspace image next.
  - **workspace image**, which using crane to copy the image from the base layer, where the base layer is either a previously built custom Dockerfile or a public image.
  These images get pushed over `localhost` to `bob proxy`, as `bob build` does not receive the credentials to push to private registries.

  The built images do not include e.g. `supervisor` or the IDE, these layers will get added by [`registry-facade`](../registry-facade/README.md) during image pull.

## How to try locally

Prerequisite: make sure you have buildkit in the path
```console
cd /tmp
curl -OL https://github.com/moby/buildkit/releases/download/v0.10.0/buildkit-v0.10.0.linux-amd64.tar.gz
tar xzfv buildkit-v0.10.0.linux-amd64.tar.gz
sudo mv bin/* /usr/bin
```

Set things up
```console
# install oci-tool for inspecting the built image
go install github.com/csweichel/oci-tool@latest

# run a local registry
docker run --rm -d -p 5000:5000 registry:latest

# produce a test image
mkdir -p /tmp/f
cd /tmp/f
cat <<EOF > Dockerfile
FROM alpine:latest
ENV foo=bar
EOF
docker build -t localhost:5000/source:latest .
docker push localhost:5000/source:latest
```

Build and run
```console
# build and install bob (do this after every change)
cd /workspace/gitpod/components/image-builder-bob
go install

# run bob
BOB_BASE_REF=localhost:5000/source:latest BOB_TARGET_REF=localhost:5000/target:83 sudo -E $(which bob) build

# debug using delve
BOB_BASE_REF=localhost:5000/source:latest BOB_TARGET_REF=localhost:5000/target:83 sudo -E $(which dlv) --listen=:2345 --headless=true --api-version=2 exec $(which bob) build
```

## Run tests

```console
cd /workspace/gitpod/components/image-builder-bob
go test -v ./...
```

# Required Permssion

If you want it to work in a particular public cloud, you may need to grant some permissions.
Below is a reference for this.

## AWS

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
                "ecr:BatchGetImage",
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:PutImage"
            ],
            "Resource": "*"
        }
    ]
}
```
