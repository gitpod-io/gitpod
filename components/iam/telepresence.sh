#!/bin/bash

# TODO(at) add config mounts

telepresence --swap-deployment iam --expose 9002 --method vpn-tcp --run go run . run
