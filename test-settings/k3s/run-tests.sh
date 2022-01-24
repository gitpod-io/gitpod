#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


#set -euo pipefail

gcloud compute scp --recurse /tests gitpod-main-node:

returncode=0

shopt -s globstar nullglob
for file in /tests/**/*.test
do
    echo "$file"
    gcloud compute ssh gitpod-main-node --zone "europe-west1-b" --command "./$file -kubeconfig=/etc/rancher/k3s/k3s.yaml"
    rc=$?
    if [[ "$rc" != "0" ]]; then
        echo "$file failed with code $rc"
        returncode=$rc
    fi
done

exit $returncode
