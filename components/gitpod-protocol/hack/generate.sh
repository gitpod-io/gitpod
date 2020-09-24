#!/bin/bash

go get -u github.com/a-h/generate/...
node -e "new (require(\"typescript-parser\").TypescriptParser)().parseFiles([\"../src/gitpod-service.ts\", \"../src/protocol.ts\", \"../src/workspace-instance.ts\"], \"../..\").then(a => console.log(JSON.stringify(a)))" | \
jq '[.[0] | .declarations[2].methods | .[] | {name: .name, params: .parameters, result: .type}]' | \
go run generate.go