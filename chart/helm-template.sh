#!/bin/bash
set -Eeuo pipefail

dir=.tmp/helm-template-$(printf "%03d" $(ls .tmp | grep helm-template- | wc -l))
mkdir -p $dir

ns="staging-master"

echo $dir/values.yaml
helm3 dep up
helm3 template . -n $ns -f values.yaml > $dir/render_values.yaml
