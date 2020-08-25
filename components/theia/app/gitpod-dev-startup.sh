#!/bin/bash

# remove the workspace prefix
export GITPOD_HOST=$(echo $GITPOD_WORKSPACE_URL | sed -e 's/\(.*\/\).*\ws-eu.\(.*\)/\1\2/')
export GITPOD_WORKSPACE_ID=$GITPOD_WORKSPACE_ID

npx theia start --hostname 0.0.0.0 --port 3000 ../../..