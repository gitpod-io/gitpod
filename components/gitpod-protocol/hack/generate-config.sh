#!/bin/bash

go get -u github.com/a-h/generate/...
echo "// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
" > ../../supervisor/pkg/gitpod/gitpod-config-types.go
schema-generate -p gitpod ../data/gitpod-schema.json >> ../../supervisor/pkg/gitpod/gitpod-config-types.go

sed -i 's/json:/yaml:/g' ../../supervisor/pkg/gitpod/gitpod-config-types.go
gofmt -w ../../supervisor/pkg/gitpod/gitpod-config-types.go
