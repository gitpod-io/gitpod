#!/bin/bash

leeway build --save /tmp/gplayer.tgz components/image-builder/workspace-image-layer:pack
export GITPOD_LAYER_LOC=/tmp/gplayer.tgz

if [ "$1" == "intp" ]; then
    echo "starting delve"
    dlv debug --listen=127.0.0.1:32991 --headless --api-version=2 github.com/gitpod-io/gitpod/image-builder -- run -v --config /tmp/imgblddebug/config/image-builder.json
    exit $?
fi

if [ "$1" == "run" ]; then
    telepresence --mount /tmp/imgblddebug --swap-deployment image-builder --method vpn-tcp --run go run main.go run -v --config /tmp/imgblddebug/config/image-builder.json
    exit $?
fi

if [ "$1" == "debug" ]; then
    telepresence --mount /tmp/imgblddebug --swap-deployment image-builder --method vpn-tcp --run "$0" intp
    exit $?
fi

echo "usage: $0 run|debug"
exit 1