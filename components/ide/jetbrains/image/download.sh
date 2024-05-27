#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

mkdir backend && cd backend || exit

# get latest info from latest properties file for preview env
if [ "$PARSE_URL_FROM_LATEST_INFO" = "true" ]; then
    TEMP_FILENAME=$(mktemp)
    PLUGIN_PLATFORM_VERSION=$(grep platformVersion= "../components-ide-jetbrains-backend-plugin--latest-info/gradle-latest.properties" | sed 's/platformVersion=//' | sed 's/-EAP-CANDIDATE-SNAPSHOT//') # Example: PLUGIN_PLATFORM_VERSION: 223.7571

    curl -sL "https://data.services.jetbrains.com/products/releases?code=$PRODUCT_CODE&type=eap,rc,release&platform=linux" > "$TEMP_FILENAME"
    IDE_BUILD_VERSION=$(jq -r -c "first(.${PRODUCT_CODE}[] | select(.build | contains(\"$PLUGIN_PLATFORM_VERSION\")) | .build)" < "$TEMP_FILENAME") # Example: IDE_BUILD_VERSION: 223.7571.176
    rm "$TEMP_FILENAME"

    if [ -n "$IDE_BUILD_VERSION" ]; then
        JETBRAINS_BACKEND_URL="https://download.jetbrains.com/product?type=release,rc,eap&distribution=linux&code=$PRODUCT_CODE&build=$IDE_BUILD_VERSION"
    else
        JETBRAINS_BACKEND_URL="https://download.jetbrains.com/product?type=release,rc,eap&distribution=linux&code=$PRODUCT_CODE"
    fi
fi

echo "Downloading from $JETBRAINS_BACKEND_URL"

curl -sSLo backend.tar.gz "$JETBRAINS_BACKEND_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz
# enable shared indexes by default
printf '\nshared.indexes.download.auto.consent=true' >> "bin/idea.properties"
