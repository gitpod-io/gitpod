#!/bin/bash

if [ "$1" == "dbg-intp" ]; then
    echo "starting delve"
    dlv debug --listen=127.0.0.1:32991 --headless --api-version=2 github.com/gitpod-io/gitpod/ws-proxy -- run -v /tmp/c/config/config.json
    exit $?
fi
if [ "$1" == "intp" ]; then
    echo "starting process"
    go run main.go run -v /tmp/c/config/config.json
    exit $?
fi

if [ "$1" == "debug" ]; then
    telepresence --mount /tmp/c --swap-deployment ws-proxy --method vpn-tcp --run "$0" dbg-intp
    exit $?
fi
telepresence --mount /tmp/c --swap-deployment ws-proxy --method vpn-tcp --run "$0" intp