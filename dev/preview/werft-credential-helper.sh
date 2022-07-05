#!/bin/bash

if [[ -f $GITHUB_TOKEN_PATH ]]; then
    cat "$GITHUB_TOKEN_PATH"
else
    curl --silent localhost:22999/_supervisor/v1/token/git/github.com/ | jq -r '.token'
fi
