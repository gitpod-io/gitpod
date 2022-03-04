#!/bin/bash

if [ "$1" == "dbg-intp" ]; then
    echo "starting delve"
    dlv debug --listen=127.0.0.1:32991 --headless --api-version=2 github.com/gitpod-io/gitpod/registry-facade -- run -v /tmp/c/mnt/config/config.json
    exit $?
fi
if [ "$1" == "intp" ]; then
    echo "starting process"
    go run main.go run -v /tmp/c/mnt/config/config.json
    exit $?
fi

telepresence --mount /tmp/c --swap-deployment registry-facade --method vpn-tcp --run "$0" dbg-intp
