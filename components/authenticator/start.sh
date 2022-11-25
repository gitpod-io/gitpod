#!/bin/bash

function start_ui() {
    yarn --cwd cmd/server/web start
}

function start_server() {
    go run cmd/server/main.go
}

start_ui &
start_server
