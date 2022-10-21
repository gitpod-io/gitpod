#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

shopt -s nocasematch

name_with_owner="gitpod-io/gitpod"

INSTALLER_DOCKER_TAG=$1

# One can either pass the new tag as the second argument or the script will take the most recent `rc` tag
if [ -z $2 ]; then
    current_tag=$(git tag --sort=-creatordate | grep -E '^[0-9|/.]*-rc[0-9]$' | head -1)
else
    current_tag="$2"
fi

# One can either pass the old tag as the third argument or the script will take the most recent stable tag
if [ -z $3 ]; then
    ## the most recent stable tag(without `-rc` is considered the previous tag
    previous_tag=$(git tag --sort=-creatordate | grep -E '^[0-9|/.]*$' | head -1)
else
    previous_tag="$3"
fi

RELEASENOTE_FILE="release-note-$current_tag.md"

echo "compare between $previous_tag & $current_tag"

commits=$(curl -s -H "Authorization: Token $ROBOQUAT_TOKEN" \
               "https://api.github.com/repos/$name_with_owner/compare/$previous_tag...$current_tag" | \
               jq -r '.commits[].sha')

{ echo -e "Docker image: \`eu.gcr.io/gitpod-core-dev/build/installer:${INSTALLER_DOCKER_TAG}\`";
  echo -e "\nPlease see the [changelog](https://www.gitpod.io/changelog/) for more information.";
  echo -e "\nRefer to the [self-hosted documentation](https://www.gitpod.io/docs/self-hosted/latest) to know more about how to setup Gitpod.";
  echo -e "\n## What has changed\n"; } > "$RELEASENOTE_FILE"

release_note=""

update_release_note() {
    url=$1
    author=$2
    msg=$(echo "$3" | tr -d '\r')
    release_note="$release_note\n * ${msg} by @${author} in ${url}"
}

# you can have a query of maximum of 256 character so we only process 17 sha for each request
count=0
max_per_request=17
while read sha; do
    if [ $count == 0 ]; then
        query="repo:$name_with_owner%20type:pr"
    fi
    query="$query%20SHA:%20${sha:0:7}"
    count=$((count+1))
    if ! (($count % $max_per_request)); then
        urls=$(curl -s -H "Authorization: Token $ROBOQUAT_TOKEN" \
            "https://api.github.com/search/issues?q=$query" | jq -r '.items[].url')
        for url in $urls; do
           pr_content=$(curl -s -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $ROBOQUAT_TOKEN" ${url})
           note=$(echo "$pr_content" | jq -r '.body' |  grep -A2 release-note | sed '/^```/d')
           user_login=$(echo "$pr_content" | jq -r '.user.login')
           pr_link=$(echo "$pr_content" | jq -r '.html_url')
           [[ "$note" == *NONE* ]] || update_release_note "$pr_link" "$user_login" "$note"
        done
        count=0
    fi
done <<< "$commits"

{ echo -e "$release_note";
  echo -e "\n\n**Full Changelog**: https://github.com/gitpod-io/gitpod/compare/$previous_tag...$current_tag"; } >>  $RELEASENOTE_FILE

echo "Release note written to $RELEASENOTE_FILE"
