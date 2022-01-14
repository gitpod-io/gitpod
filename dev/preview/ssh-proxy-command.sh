#!/usr/bin/env bash

port="$1"
namespace="$2"

kubectl \
    --context=harvester \
    --kubeconfig=/home/gitpod/.kube/config \
    -n "${namespace}" port-forward service/proxy "${port}:22" > /dev/null 2>&1 &

# Wait for the port to be read
sleep 5

# Use netcat as SSH expects ProxyCommand to read and write using stdin/stdout
nc -X connect localhost "${port}"
