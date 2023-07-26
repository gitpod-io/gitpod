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
# TODO(gpl) If we like this approach we should think about moving this into the installer as "list-images" or similar
#           This would also remove the dependency to our dev image (yq4)
INSTALLER="$TMP/installer"
"$OCI_TOOL" fetch file -o "$INSTALLER" --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" app/installer
echo ""
chmod +x "$INSTALLER"
# Extract list of images from rendered YAMLs
"$INSTALLER" config init -c "$TMP/config.yaml" --log-level=warn
"$INSTALLER" render -c "$TMP/config.yaml" --no-validation > "$TMP/rendered.yaml"
yq4 --no-doc '(.. | select(key == "image" and tag == "!!str"))' "$TMP/rendered.yaml" > "$TMP/images.txt"

# shellcheck disable=SC2002
TOTAL_IMAGES=$(cat "$TMP/images.txt" | wc -l)
echo "=== Found $TOTAL_IMAGES images to scan"

# Scan all images, and push the result to Lacework
# There, we can see the results in the "Vulnerabilities" tab, by searching for the Gitpod version
# Note: Does not fail on CVEs!
COUNTER=0
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
    --tags version="$VERSION" > /dev/null
done < "$TMP/images.txt"
