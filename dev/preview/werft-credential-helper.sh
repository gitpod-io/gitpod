#!/bin/bash

curl --silent localhost:22999/_supervisor/v1/token/git/github.com/ | jq -r '.token'