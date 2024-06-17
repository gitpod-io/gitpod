#!/usr/bin/env bash
# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.


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
