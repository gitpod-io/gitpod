#!/bin/bash

if [[ -f $WERFT_GITHUB_TOKEN_PATH ]]; then
    cat "$WERFT_GITHUB_TOKEN_PATH"
else
    curl --silent localhost:22999/_supervisor/v1/token/git/github.com/ | jq -r '.token'
fi
