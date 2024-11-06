#!/usr/bin/env bash
# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# This script is used to test JetBrains prebuild warmup indexing (search warmup-indexing.sh in codebase)
# It will get the last indexing json file (scan reason `On project open`)
# and check if the scheduled indexing count is greater than a specified threshold
#
# `exit 0` means JetBrains IDEs no need to indexing again
# Example: ./warmup-indexing.sh /workspace 1

set -euo pipefail
SystemDir=$1
Threshold=$2

ProjectIndexingFolder=$(find "$SystemDir"/log/indexing-diagnostic -type d -name "spring*" -print -quit)
JsonFiles=$(find "$ProjectIndexingFolder" -type f -name "*.json")

FilteredJsonFiles=()
for jsonFile in $JsonFiles; do
    if jq -e '.projectIndexingActivityHistory.times.scanningReason == "On project open"' "$jsonFile" > /dev/null; then
        FilteredJsonFiles+=("$jsonFile")
    fi
done
mapfile -t sortedFiles < <(printf "%s\n" "${FilteredJsonFiles[@]}" | sort -r)

targetFile=${sortedFiles[0]}
echo "Target indexing json file: $targetFile"
scheduledIndexing=$(jq '.projectIndexingActivityHistory.fileCount.numberOfFilesScheduledForIndexingAfterScan' "$targetFile")
echo "Scheduled indexing count: $scheduledIndexing, threshold: $Threshold"

if [ "$scheduledIndexing" -gt "$Threshold" ]; then
    echo "Error: Scheduled indexing count $scheduledIndexing > $Threshold" >&2
    exit 1
else
    exit 0
fi
