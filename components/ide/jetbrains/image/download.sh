#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

mkdir backend && cd backend || exit
curl -sSLo backend.tar.gz "$JETBRAINS_BACKEND_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz
# enable shared indexes by default
printf '\nshared.indexes.download.auto.consent=true' >> "bin/idea.properties"
