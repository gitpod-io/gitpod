#!/bin/bash

telepresence --mount /tmp/c --swap-deployment kedge --method vpn-tcp --run go run -race main.go run -v --config /tmp/c/config/config.json --kubeconfig ~/.kube/config
