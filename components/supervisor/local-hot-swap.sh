#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# This script swaps the backend startup endpoint with a built one
# in a workspace and restarts the JB backend.

component=${PWD##*/}

# build
go build .
echo "$component built"

sudo rm /.supervisor/supervisor && true
sudo mv ./"$component" /.supervisor
echo "Local Swap complete"
