#!/usr/bin/env bash
# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# This script is used to test JetBrains prebuild warmup indexing (search warmup-indexing.sh in codebase)
# It will get the last indexing json file (scan type FULL_ON_PROJECT_OPEN)
# and check if the scheduled indexing count is 0
#
# `exit 0` means JetBrains IDEs no need to indexing again

set -euo pipefail
SystemDir=$1

ProjectIndexingFolder=$(find "$SystemDir"/log/indexing-diagnostic -type d -name "spring*" -print -quit)
JsonFiles=$(find "$ProjectIndexingFolder" -type f -name "*.json")

FilteredJsonFiles=()
for jsonFile in $JsonFiles; do
    if jq -e '.projectIndexingActivityHistory.times.scanningType == "FULL_ON_PROJECT_OPEN"' "$jsonFile" > /dev/null; then
        FilteredJsonFiles+=("$jsonFile")
    fi
done
mapfile -t sortedFiles < <(printf "%s\n" "${FilteredJsonFiles[@]}" | sort -r)

targetFile=${sortedFiles[0]}
echo "Target indexing json file: $targetFile"
scheduledIndexing=$(jq '.projectIndexingActivityHistory.fileCount.numberOfFilesScheduledForIndexingAfterScan' "$targetFile")
echo "Scheduled indexing count: $scheduledIndexing"

[ "$scheduledIndexing" -ne 0 ] && exit 1 || exit 0
