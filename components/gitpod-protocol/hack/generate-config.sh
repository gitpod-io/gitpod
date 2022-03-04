#!/bin/bash

go install -u github.com/a-h/generate/...

schema-generate -p protocol ../data/gitpod-schema.json > ../go/gitpod-config-types.go

sed -i 's/json:/yaml:/g' ../go/gitpod-config-types.go
gofmt -w ../go/gitpod-config-types.go

leeway run components:update-license-header
