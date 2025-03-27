#!/bin/bash
# Copyright (c) 2025 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -uo pipefail

# Check if VERSION and FAIL_ON are provided
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 VERSION FAIL_ON [TRIVY_ARGS...]"
  echo "  VERSION: The version to scan (e.g., main-gha.32006)"
  echo "  FAIL_ON: Severity threshold to fail on (empty, HIGH, or CRITICAL)"
  echo "  TRIVY_ARGS: Additional arguments to pass to Trivy"
  echo "Example: $0 main-gha.32006 HIGH"
  exit 1
fi

INSTALLER_IMAGE_BASE_REPO="${INSTALLER_IMAGE_BASE_REPO:-eu.gcr.io/gitpod-dev-artifact}"

# Extract VERSION and FAIL_ON from arguments and remove them from args list
VERSION="$1"
FAIL_ON="$2"
shift 2

# Validate FAIL_ON value
if [[ -n "$FAIL_ON" ]] && [[ "$FAIL_ON" != "HIGH" ]] && [[ "$FAIL_ON" != "CRITICAL" ]]; then
  echo "Error: FAIL_ON must be either empty, 'HIGH', or 'CRITICAL'"
  exit 1
fi


if ! command -v jq &> /dev/null; then
  echo "jq not found. Please install jq to continue."
  exit 1
fi

# Set up working directory
SCAN_DIR=$(mktemp -d -t trivy-scan-XXXXXX)
echo "Working directory: $SCAN_DIR"

# Directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR"
INSTALLER_CONFIG_FILE="scan-installer-config.yaml"
TRIVYIGNORE_PATH="$SCRIPT_DIR/trivyignore.yaml"

# Ensure Trivy is installed
TRIVY_CMD="trivy"
if ! command -v "$TRIVY_CMD" &> /dev/null; then
  echo "Trivy not found. Installing..."
  mkdir -p "$SCAN_DIR/bin"
  TRIVY_CMD="$SCAN_DIR/bin/trivy"
  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b "$SCAN_DIR/bin"
fi

echo "=== Gathering list of all images for $VERSION"

# Run the installer docker image to get the list of images
docker run --rm -v "$CONFIG_DIR:/config" "$INSTALLER_IMAGE_BASE_REPO/build/installer:${VERSION}" mirror list \
  -c "/config/$INSTALLER_CONFIG_FILE" > "$SCAN_DIR/mirror.json"

# Extract original image references
jq -r '.[].original' "$SCAN_DIR/mirror.json" > "$SCAN_DIR/images.txt"

# Remove empty lines
sed -i '/^\s*$/d' "$SCAN_DIR/images.txt"

# Filter out specific image patterns
echo "=== Filtered out images:"
TOTAL_BEFORE=$(wc -l < "$SCAN_DIR/images.txt")

# Apply all filters at once using extended regex
grep -v -E "/build/ide/|/gitpod/workspace-|/library/mysql|/library/redis|/cloudsql-docker/gce-proxy" "$SCAN_DIR/images.txt" > "$SCAN_DIR/filtered_images.txt"

TOTAL_AFTER=$(wc -l < "$SCAN_DIR/filtered_images.txt")
FILTERED=$((TOTAL_BEFORE - TOTAL_AFTER))

echo "  Total filtered: $FILTERED"

# Use filtered list for scanning
mv "$SCAN_DIR/filtered_images.txt" "$SCAN_DIR/images.txt"

# Count total images
TOTAL_IMAGES=$(wc -l < "$SCAN_DIR/images.txt")
echo "=== Found $TOTAL_IMAGES images to scan"

# Create results directory
RESULT_FILE="$SCAN_DIR/result.jsonl"

# Scan all images with Trivy
COUNTER=0
FAILED=0
while IFS= read -r IMAGE_REF; do
  ((COUNTER=COUNTER+1))

  echo "= Scanning $IMAGE_REF [$COUNTER / $TOTAL_IMAGES]"

  # Run Trivy on the image
  scan_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  trivy_output=$("$TRIVY_CMD" image "$IMAGE_REF" --ignorefile "$TRIVYIGNORE_PATH" --scanners vuln --format json "$@" | jq -c)
  scan_status=$?

  # Create a JSON object for the current scan
  if [ $scan_status -eq 0 ]; then
      # Check if trivy_output is valid JSON
      if echo "$trivy_output" | jq empty > /dev/null 2>&1; then
          # Direct approach - create the combined JSON object using jq directly
          jq -c --arg image "$IMAGE_REF" --arg scan_time "$scan_time" \
              '. + {image: $image, scan_time: $scan_time}' <<< "$trivy_output" | jq >> "$RESULT_FILE"
      else
          # If trivy output is not valid JSON, treat as error
          echo "Warning: Trivy returned invalid JSON for $IMAGE_REF"
          jq -n --arg image "$IMAGE_REF" \
                --arg scan_time "$scan_time" \
                --arg error "Invalid JSON output from Trivy" \
                --arg details "$trivy_output" \
                '{image: $image, scan_time: $scan_time, error: $error, error_details: $details}' | jq >> "$RESULT_FILE"
          ((FAILED=FAILED+1))
      fi

  else
      # For error cases, create a simple JSON object
      jq -n --arg image "$IMAGE_REF" \
            --arg scan_time "$scan_time" \
            --arg error "Trivy scan failed" \
            --arg details "$trivy_output" \
            '{image: $image, scan_time: $scan_time, error: $error, error_details: $details}' >> "$RESULT_FILE"
          ((FAILED=FAILED+1))
  fi

  echo ""
done < "$SCAN_DIR/images.txt"

# Generate summary report
echo "=== Scan Summary ==="
echo "Scan directory: $SCAN_DIR"
echo "Results file: $RESULT_FILE"
echo "Total ignored images: $FILTERED"
echo "Total scanned images: $TOTAL_IMAGES"
echo "Failed scans: $FAILED"
echo "Triviy binary: $TRIVY_CMD"
echo "Triviy version: $($TRIVY_CMD version)"
echo ""

# Count vulnerabilities by severity
echo "=== Vulnerability Summary ==="
CRITICAL="$(jq -r 'if .Results != null then [.Results[].Vulnerabilities // [] | .[] | select(.Severity == "CRITICAL")] | length else 0 end' "$RESULT_FILE" 2>/dev/null | awk '{sum+=$1} END {print sum}')"
HIGH="$(jq -r 'if .Results != null then [.Results[].Vulnerabilities // [] | .[] | select(.Severity == "HIGH")] | length else 0 end' "$RESULT_FILE" 2>/dev/null | awk '{sum+=$1} END {print sum}')"
echo "CRITICAL: $CRITICAL"
echo "HIGH: $HIGH"
echo ""

echo "=== Scan completed ==="
if [[ $FAILED -gt 0 ]]; then
  echo "ERROR: $FAILED scans failed"
  exit 1
fi

# Check if we should fail based on vulnerability counts
if [[ "$FAIL_ON" == "CRITICAL" ]] && [[ $CRITICAL -gt 0 ]]; then
  echo "FAIL: Found $CRITICAL CRITICAL vulnerabilities, and FAIL_ON=CRITICAL was specified"
  exit 1
elif [[ "$FAIL_ON" == "HIGH" ]] && [[ $((CRITICAL + HIGH)) -gt 0 ]]; then
  echo "FAIL: Found $CRITICAL CRITICAL and $HIGH HIGH vulnerabilities, and FAIL_ON=HIGH was specified"
  exit 1
fi

echo "0 $FAIL_ON or higher vulnerabilities found."
exit 0
