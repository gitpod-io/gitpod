#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

if [[ "$#" -lt 1 ]]; then
    echo "Usage: $0 <playbook name> [<ansible-playbook args>]" >&2
    printf "\nAvailable playbooks:\n" >&2
    for f in /ansible/*.yaml; do
        echo "- $(basename "$f" .yaml)" >&2
    done
    exit 1
fi

playbook="$1"
shift

if [[ "$playbook" == gcp* ]]; then
    echo "Using /ansible/ansible.gcp.cfg ..."
    export ANSIBLE_CONFIG=/ansible/ansible.gcp.cfg

    # Hack to configure the GCP project into inventory.gcp.yaml
    gcp_project=$(yq e '.gcp_project' "/ansible/vars/$playbook.yaml")
    yq e -i ".projects = [\"${gcp_project}\"]" /ansible/inventory/inventory.gcp.yaml
    cat /ansible/inventory/inventory.gcp.yaml
fi

ansible-playbook "$@" "/ansible/${playbook}.yaml"
