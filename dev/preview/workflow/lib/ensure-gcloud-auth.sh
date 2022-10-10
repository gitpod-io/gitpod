#!/usr/bin/env bash

# this script is meant to be sourced

function ensure_gcloud_auth() {
    if [[ $(gcloud auth list --format=json) == '[]' ]]; then
        echo
        echo "Currently you need to be authenticated with gcloud to run the build"
        echo
        echo "This is needed to you can use the Leeway build cache that Werft also uses"
        echo "We're working on automating this here: https://github.com/gitpod-io/gitpod/issues/13714"
        echo
        echo "But for now you have to run the following log in manually"
        echo
        gcloud auth login --no-launch-browser
        echo
        echo "Great, thanks!"
        echo
        echo "Continuing the build"
    fi
}
