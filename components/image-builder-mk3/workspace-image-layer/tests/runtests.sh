#!/bin/bash

# Quit immediately on non-zero exit code
set -e;

BASE=$(pwd)

cd positive

for DOCKERFILE in ls *.dockerfile; do
    echo "********* BEGIN TEST $DOCKERFILE ************"
    BASE_IMG="$DOCKERFILE:test"
    WORKSPACE_IMG="$DOCKERFILE:layered"
    WORKSPACE="$(sudo rm -rf .tmp; mkdir .tmp; cd .tmp; pwd)"

    cp "$BASE/"../scripts/* "$WORKSPACE"
    cp "$BASE/positive/verify.sh" "$WORKSPACE"
    docker build -f "$DOCKERFILE" -t "$BASE_IMG" .
    docker run -v "$WORKSPACE":/workspace "$BASE_IMG" /workspace/detect-distro.sh
    # Fake-satisfy generate-dockerfile.sh dependency
    touch "$BASE/../gitpod-cli"
    docker run -v "$WORKSPACE":/workspace -v "$BASE/..":/base "$BASE_IMG" sh -c "cd /workspace && /base/scripts/generate-dockerfile.sh $BASE_IMG"

    docker build -f "$WORKSPACE/Dockerfile" -t "$WORKSPACE_IMG" "$WORKSPACE"

    echo "docker run -v $WORKSPACE:/workspace $WORKSPACE_IMG /workspace/verify.sh"
    if ! docker run -v "$WORKSPACE:/workspace" --entrypoint="" "$WORKSPACE_IMG" /workspace/verify.sh; then
        echo "verify.sh failed."
        exit 1
    fi
    sudo rm -rf "$WORKSPACE"
    rm -f "$BASE/../gitpod-cli"
    echo "********* END TEST $DOCKERFILE ************"
done
