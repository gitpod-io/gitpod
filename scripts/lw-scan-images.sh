#!/bin/bash
set -euo pipefail

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

echo "Gathering list of _all_ images for $VERSION"
# TODO(gpl) If we like this approach we should think about moving this into the installer as "list-images" or similar
#           This would also remove the dependency to our dev image (yq4)
docker run -v "$TMP":/workdir "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" config init -c "/workdir/config.yaml" --log-level=warn
docker run -v "$TMP":/workdir "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" render -c "/workdir/config.yaml" --no-validation > "$TMP/rendered.yaml"
yq4 --no-doc '(.. | select(key == "image" and tag == "!!str"))' "$TMP/rendered.yaml" > "$TMP/images.txt"
# shellcheck disable=SC2002
echo "Found $(cat "$TMP/images.txt" | wc -l) images to scan"

# Scan all images, and push the result to Lacework
# There, we can see the results in the "Vulnerabilities" tab, by searching for the Gitpod version
# Note: Does not fail on CVEs!
while IFS= read -r IMAGE_REF; do
  # Skip images with this prefix
  # TODO(gpl) Unclear why we can't access the docker.io images; it works from a workspace?
  if [[ "$IMAGE_REF" == "docker.io/"* ]]; then
    echo "Skipping $IMAGE_REF"
    continue
  fi

  NAME=$(echo "$IMAGE_REF" | cut -d ":" -f 1)
  TAG=$(echo "$IMAGE_REF" | cut -d ":" -f 2)
  echo "Scanning $NAME : $TAG"
  "$SCANNER" image evaluate "$NAME" "$TAG" \
    --account-name gitpod \
    --access-token "$LW_ACCESS_TOKEN" \
    --build-id "$VERSION" \
    --ci-build=true \
    --disable-library-package-scanning=false \
    --save=true \
    --tags version="$VERSION" > /dev/null
done < "$TMP/images.txt"
