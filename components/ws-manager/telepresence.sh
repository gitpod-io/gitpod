#!/bin/bash

if [ "$1" == "intp" ]; then
    echo "starting delve"
    dlv debug --listen=127.0.0.1:32991 --headless --api-version=2 github.com/gitpod-io/gitpod/ws-manager -- run -v --config /tmp/c/config/config.json --kubeconfig ~/.kube/config
    exit $?
fi

alsoProxy=""
for h in $(kubectl get pods -l component=ws-daemon --no-headers -o=custom-columns=:status.hostIP | grep -v none); do
    echo "Also proxying ws-daemon daemon on ${h}"
    alsoProxy="${alsoProxy} --also-proxy ${h}"
done

telepresence "${alsoProxy}" --mount /tmp/c --swap-deployment ws-manager --method vpn-tcp --run "$0" intp
