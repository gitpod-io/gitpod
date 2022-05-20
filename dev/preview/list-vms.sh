#!/usr/bin/env bash

set -eup pipefail

kubectl --context=harvester get vms -A -o=jsonpath='{.items[*].metadata.name}' | xargs -n 1 echo
