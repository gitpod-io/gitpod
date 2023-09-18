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

DIST_COMPONENT="jb-launcher"
mv "$COMPONENT" "$DIST_COMPONENT"
echo "rename $COMPONENT to $DIST_COMPONENT"
COMPONENT="$DIST_COMPONENT"

DEST="/ide-desktop"
sudo rm -rf "$DEST/$COMPONENT" && true
sudo mv ./"$COMPONENT" "$DEST"
echo "$COMPONENT in $DEST replaced"
