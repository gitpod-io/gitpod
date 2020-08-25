#!/bin/bash

# ws-manager-node ships with delve in the image. This script activates it and opens a port-forward

kubectl patch daemonset ws-manager-node --patch '{"spec": {"template": {"spec": {"containers": [{"name": "ws-manager-node","command": ["dlv"],"args": ["exec", "--listen=127.0.0.1:32991", "--headless", "--api-version=2", "--", "/app/ws-manager-node", "run", "-v", "--config", "/config/config.json"]}]}}}}'
kubectl get pods --no-headers -o=custom-columns=:metadata.name | grep ws-manager-node | xargs kubectl delete pod

echo "waiting for ws-manager-node on node which has a workspace running. Make sure you have a workspace running in this namespace."
for i in $(seq 1 10); do
    node=$(kubectl get pod -l component=workspace -o json | jq -r '.items[].spec.nodeName' | xargs kubectl describe node | grep ws-manager-node | sed 's/\s\+/ /g' | cut -d ' ' -f 3 | head -n1)
    if [ ! -z "$node" ]; then
        # wait for the container to come up
        sleep 2
        echo "found $node"

        echo "getting source path"
        srcpath=$(kubectl exec -it $node -- strings /app/ws-manager-node | grep /tmp/build/ |  sed -e 'N;s/^\(.*\).*\n\1.*$/\1\n\1/;D' | head -n 1)

        yq w -i $HOME/.config/dlv/config.yml substitute-path[+].from $srcpath
        yq w -i $HOME/.config/dlv/config.yml substitute-path[*].to $PWD

        _term() { 
            echo "Caught SIGTERM signal!" 
            ps guax | grep kubectl | grep ws-manager-node-g6kxg | sed 's/\s\+/ /g' | cut -d ' ' -f 2 | xargs kill
        }
        trap _term SIGTERM

        echo "starting debugging session on $node"
        kubectl port-forward $node 32991
    fi

    sleep 5
done
