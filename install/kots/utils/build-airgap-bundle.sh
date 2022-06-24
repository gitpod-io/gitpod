#!/usr/bin/env bash
#
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

set -euo pipefail

if [[ $# -lt 3 ]]; then
    >&2 echo "Usage: $0 <KOTS license file> <old tag> <new tag> [<output file>] [<tmp folder>]"
    >&2 echo ""
    >&2 echo "Builds a KOTS air-gap bundle that has only images that changed between <old tag> build and <new tag> build."
    exit 2
fi

license_file="$1"
from_tag="$2"
to_tag="$3"
output_file="${4:-bundle-${from_tag}-${to_tag}.tar}"
tmp_folder="${5:-$(mktemp -d)}"
bundle_folder="$tmp_folder/bundle"
installer_config_file="$(realpath "$tmp_folder/config.yaml")"

yq=""
if [[ "$(yq --version)" == *"version 4"* ]]; then
    yq="yq"
elif [[ "$(yq4 --version)" == *"version 4"* ]]; then
    yq="yq4"
else
    >&2 echo "Cannot find yq version 4 binary."
    exit 3
fi

cat << EOF > "$installer_config_file"
domain: example.com
repository: example.com
EOF

installer_image=eu.gcr.io/gitpod-core-dev/build/installer
jq_query=".[] | .original"
from_images=$(docker run --rm -v "$installer_config_file":/config.yaml "$installer_image":"$from_tag" mirror list -c /config.yaml | jq -rc "$jq_query")
to_images=$(docker run --rm -v "$installer_config_file":/config.yaml "$installer_image":"$to_tag" mirror list -c /config.yaml | jq -rc "$jq_query")
new_images=$(comm -1 -3 <(echo "$from_images" | sort) <(echo "$to_images" | sort))

new_images="$installer_image:$to_tag
$new_images"

images_folder="$bundle_folder/images/docker-archive"

for image in $new_images; do
    image_name_full="$(cut -d':' -f1 <<<"$image")"
    image_tag=$(cut -d':' -f2 <<<"$image")
    image_folder="$images_folder/$image_name_full"

    echo ""
    echo "image_name_full: $image_name_full"
    echo "image_tag:       $image_tag"
    echo "image_folder:    $image_folder"

    mkdir -p "$image_folder"
    docker pull "$image"
    docker save "$image" -o "$image_folder/$image_tag"
done

# Replicated API: https://github.com/replicatedhq/kots/blob/8bc90aa1b08691ce2f723a2b3a725d952faf6ae3/pkg/upstream/replicated_test.go
replicated_endpoint="$($yq .spec.endpoint  "$license_file")"
channel_name="$($yq .spec.channelName "$license_file")"
license_id="$($yq .spec.licenseID "$license_file")"
license_sequence="$($yq .spec.licenseSequence "$license_file")"
curl -sSo "$bundle_folder/app.tar.gz" --user "$license_id:$license_id" "$replicated_endpoint/release/gitpod/$channel_name?licenseSequence=$license_sequence"


echo ""
tar -cf "$output_file" -C "$bundle_folder" --xform s:'./':: .
tar -tvf "$output_file"

echo ""
echo "Bundle saved as: $output_file"
