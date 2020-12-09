#!/bin/bash
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# First check if labels are actually still present in the nodes
if kubectl get node $EXECUTING_NODE_NAME -o template='{{ range $k, $v := .metadata.labels}}{{ $k }}{{"\n"}}{{ end }}' | grep -q "gitpod.io/theia.$VERSION"; then
    
    # If yes then attempt to remove them manually 
    if kubectl patch node $EXECUTING_NODE_NAME --patch '{"metadata":{"labels":{}}}'; then
        echo "Unmarked the node successfully"
    else
        # If it fails, then instruct the user to manually remove the labels before reinstallation
        echo "Unmarking the node failed. Manually unmark it before reinstall."
        exit -1
    fi
fi