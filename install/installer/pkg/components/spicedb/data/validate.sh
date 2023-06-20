#!/bin/bash

if ! command -v zed &> /dev/null
then
    echo "zed could not be found, installing with Homebrew..."
    brew install authzed/tap/zed
fi

PORT=50051

if ! nc -z localhost $PORT; then
    echo "Port $PORT is not available, forwarding port..."
    kubectl port-forward service/spicedb $PORT &
    sleep 5
fi

ZED_KEYRING_PASSWORD=$(kubectl get secrets spicedb-secret -o jsonpath="{.data.presharedKey}")
export ZED_KEYRING_PASSWORD

zed context set preview "localhost:$PORT" "$ZED_KEYRING_PASSWORD"
zed schema read
