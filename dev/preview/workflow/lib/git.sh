#!/usr/bin/env bash

# this script is meant to be sourced

function git:branch-name {
    git rev-parse --abbrev-ref HEAD
}

function git:is-on-main {
    if [[ "$(git:branch-name)" == "main" ]]
    then return 0
    else return 1
    fi
}

function git:branch-exists-remotely {
    git ls-remote --exit-code --heads origin "$(git:branch-name)" > /dev/null
}
