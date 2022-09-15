#!/bin/bash

sudo curl -fL https://app.getambassador.io/download/tel2/linux/amd64/latest/telepresence -o /usr/local/bin/telepresence2
sudo chmod a+x /usr/local/bin/telepresence2

telepresence2 helm install
telepresence2 connect
telepresence2 list

echo "Type 'telepresence2 intercept usage --service usage --port 9001 --mount=true -- go run . run'"
