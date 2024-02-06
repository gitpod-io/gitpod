#!/bin/bash
set -euo pipefail

if [[ -z "$VERSION" ]]; then
  echo "VERSION env var is required"
  exit 1
fi

if [[ -z "$LW_ACCESS_TOKEN" ]]; then
  echo "LW_ACCESS_TOKEN env var is required"
  exit 1
fi

EXCLUDE_DOCKER_IO="${EXCLUDE_DOCKER_IO:-"false"}"

TMP=$(mktemp -d)
echo "workdir: $TMP"

HOME="/home/gitpod"
BIN="$HOME/bin"
mkdir -p "$BIN"

SCANNER="$BIN/lw-scanner"
if [ ! -f "$SCANNER" ]; then
  curl -L https://github.com/lacework/lacework-vulnerability-scanner/releases/latest/download/lw-scanner-linux-amd64 -o "$SCANNER"
  chmod +x "$SCANNER"
fi

OCI_TOOL="$BIN/oci-tool"
OCI_TOOL_VERSION="0.2.0"
if [ ! -f "$OCI_TOOL" ]; then
  curl -fsSL https://github.com/csweichel/oci-tool/releases/download/v${OCI_TOOL_VERSION}/oci-tool_${OCI_TOOL_VERSION}_linux_amd64.tar.gz | tar xz -C "$(dirname "$OCI_TOOL")" && chmod +x "$OCI_TOOL"
fi

echo "=== Gathering list of _all_ images for $VERSION"
INSTALLER="$TMP/installer"
"$OCI_TOOL" fetch file -o "$INSTALLER" --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" app/installer
echo ""
chmod +x "$INSTALLER"
# Extract list of images
echo "apiVersion: v1" > "$TMP/config.yaml"
"$INSTALLER" mirror list --domain example.com --repository example.com -c "$TMP/config.yaml" | yq4 '.[] | .original' > "$TMP/images.txt"
# Remove empty lines
sed -i '/^\s*$/d' "$TMP/images.txt"

# shellcheck disable=SC2002
TOTAL_IMAGES=$(cat "$TMP/images.txt" | wc -l)
echo "=== Found $TOTAL_IMAGES images to scan"

# Scan all images, and push the result to Lacework
# There, we can see the results in the "Vulnerabilities" tab, by searching for the Gitpod version
# Note: Does not fail on CVEs!
COUNTER=0
FAILED=0
while IFS= read -r IMAGE_REF; do
  ((COUNTER=COUNTER+1))
  # TODO(gpl) Unclear why we can't access the docker.io images the GitHub workflow; it works from a workspace?
  if [[ "$EXCLUDE_DOCKER_IO" == "true" ]]; then
    if [[ "$IMAGE_REF" == "docker.io/"* ]]; then
      echo "= Skipping docker.io image: $IMAGE_REF"
      continue
    fi
  fi

  NAME=$(echo "$IMAGE_REF" | cut -d ":" -f 1)
  TAG=$(echo "$IMAGE_REF" | cut -d ":" -f 2)
  echo "= Scanning $NAME : $TAG [$COUNTER / $TOTAL_IMAGES]"
  "$SCANNER" image evaluate "$NAME" "$TAG" \
    --account-name gitpod \
    --access-token "$LW_ACCESS_TOKEN" \
    --build-id "$VERSION" \
    --ci-build=true \
    --disable-library-package-scanning=false \
    --save=true \
    --tags version="$VERSION" > /dev/null || ((FAILED=FAILED+1))
  echo ""
done < "$TMP/images.txt"

echo "number of failed image scans: $FAILED of $COUNTER"
if (( FAILED > 0 )); then
  exit 1
fi
