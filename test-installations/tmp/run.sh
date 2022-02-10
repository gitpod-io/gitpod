#!/bin/bash

TAG=clu-gcp-vm-k3s.67
PLAYBOOK=$1

shift

# -v "$(pwd)/gitpod-installer:/installer/gitpod-installer" \

time docker run --rm -it \
    -v "$(pwd)/service-account.json:/service-account.json:ro" \
    -v /workspace/gitpod/test-installations/ansible:/ansible:ro \
    eu.gcr.io/gitpod-core-dev/build/test-installations:$TAG "$PLAYBOOK" "$@"
