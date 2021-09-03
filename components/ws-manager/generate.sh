#!/bin/bash

set -ex -o pipefail

go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.4.1
controller-gen object paths=./...
controller-gen crd paths=./... output:dir=crd
leeway run components:update-license-header