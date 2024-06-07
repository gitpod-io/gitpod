#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

ROOT_DIR="$(dirname "$0")/../../../.."
PRODUCT_CODE=${1}
JB_FALLBACK_URL=${2}
TEMP_FILENAME=$(mktemp)
PLUGIN_PLATFORM_VERSION=$(grep platformVersion= "$ROOT_DIR/components/ide/jetbrains/backend-plugin/gradle-latest.properties" | sed 's/platformVersion=//' | sed 's/-EAP-CANDIDATE-SNAPSHOT//') # Example: PLUGIN_PLATFORM_VERSION: 223.7571

curl -sL "https://data.services.jetbrains.com/products/releases?code=$PRODUCT_CODE&type=eap,rc,release&platform=linux" > "$TEMP_FILENAME"
IDE_BUILD_VERSION=$(jq -r -c "first(.${PRODUCT_CODE}[] | select(.build | contains(\"$PLUGIN_PLATFORM_VERSION\")) | .build)" < "$TEMP_FILENAME") # Example: IDE_BUILD_VERSION: 223.7571.176
IDE_VERSION=$(jq -r -c "first(.${PRODUCT_CODE}[] | select(.build | contains(\"$PLUGIN_PLATFORM_VERSION\")) | .version)" < "$TEMP_FILENAME") # Example: IDE_VERSION: 2022.3

if [ -z "$IDE_BUILD_VERSION" ] || [ -z "$IDE_VERSION" ]; then
    if [ -n "$JB_FALLBACK_URL" ]; then
        # echo "Could not resolve latest IDE version for $PRODUCT_CODE. Falling back to find $JB_FALLBACK_URL"
        IDE_BUILD_VERSION=$(jq -r -c "first(.${PRODUCT_CODE}[] | select(.downloads.linux.link == \"$JB_FALLBACK_URL\") | .build)" < "$TEMP_FILENAME") # Example: IDE_BUILD_VERSION: 223.7571.176
        IDE_VERSION=$(jq -r -c "first(.${PRODUCT_CODE}[] | select(.downloads.linux.link == \"$JB_FALLBACK_URL\") | .version)" < "$TEMP_FILENAME") # Example: IDE_VERSION: 2022.3
    fi
fi

rm "$TEMP_FILENAME"

echo "{\"IDE_BUILD_VERSION\": \"$IDE_BUILD_VERSION\", \"IDE_VERSION\": \"$IDE_VERSION\"}"
