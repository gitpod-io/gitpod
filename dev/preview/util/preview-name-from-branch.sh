#!/usr/bin/env bash

#
# Based on the name of the current branch this will compute the name of the associated
# preview environment.
#
# NOTE: This needs to produce the same result as the function in .werft/util/preview.ts
#        See the file for implementation notes.
#
function preview-name-from-branch {
    set +u
    local BRANCH="$1"

    if [ "$BRANCH" == "" ]; then
        branch_name=$(git symbolic-ref HEAD 2>&1) || error "Cannot get current branch"
    else
        branch_name=$BRANCH
    fi


    sanitizedd_branch_name=$(echo "$branch_name" | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')
    length=$(echo -n "$sanitizedd_branch_name" | wc -c)

    if [ "$length" -gt 20 ]; then
        hashed=$(echo -n "${sanitizedd_branch_name}" | sha256sum)
        echo "${sanitizedd_branch_name:0:10}${hashed:0:10}"
    else
        echo "${sanitizedd_branch_name}"
    fi
}
