#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -x

go install github.com/golang/mock/mockgen@v1.6.0

mockgen \
    -package=protocol \
    -self_package=github.com/gitpod-io/gitpod/gitpod-protocol \
    -source=gitpod-service.go > mock.go_tmp > mock.go_tmp

mv mock.go_tmp mock.go

leeway run components:update-license-header
