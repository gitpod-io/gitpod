#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# Parameters:
#   $1: BASE_IMAGE
BASE_DIR="$( cd "$( dirname "$0" )/.." >/dev/null 2>&1 && pwd )"
BASE_IMAGE=$1

# 1. Read distro value
DISTRO_IN_FILE="/workspace/distro"
if [ ! -f "$DISTRO_IN_FILE" ]; then
    echo "Unable to find file $DISTRO_IN_FILE. Exit with code 1.";
    exit 1;
fi
DISTRO=$(cat $DISTRO_IN_FILE)
if [ -z "$DISTRO" ] || [ "$DISTRO" = "UNDEFINED" ]; then
    echo "Distro value '$DISTRO'! Exit with code 1.";
    exit 1;
fi
# The file has served it's purpose, now move it out of the way
rm -f $DISTRO_IN_FILE

# 2. Copy distro-specific files into workspace (default path in Google Cloud Container builder: /workspace)
DISTRO_PATH="$BASE_DIR/gitpod-layer/$DISTRO"
cp -R "$DISTRO_PATH"/. ./

# 3. Copy the gitpod-cli into the workspaace
cp "$BASE_DIR"/gitpod-cli gitpod-cli

# 4. Create Dockerfile in /workspace starting from BASE_IMAGE and append the distro-specific part
echo "FROM $BASE_IMAGE" > Dockerfile
(cat "$BASE_DIR/gitpod-layer/prepend.dockerfile"; echo) >> Dockerfile
cat "$DISTRO_PATH/Dockerfile" >> Dockerfile

echo "Generated Dockerfile with BASE_IMAGE: $BASE_IMAGE"
