#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

DIR="$(dirname "$(realpath "$0")")"
COMPONENT="$(basename "$DIR")"
cd "$DIR"

# build
go build .
echo "$COMPONENT built"

sudo rm -rf "/ide/$COMPONENT" && true
sudo mv ./"$COMPONENT" /ide
sudo cp supervisor-ide-config.json /ide
echo "$COMPONENT in /ide replaced"
