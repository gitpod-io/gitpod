#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -x

go install github.com/golang/mock/mockgen@v1.6.0

mkdir -p mock

mockgen \
    -package=mock \
    github.com/gitpod-io/gitpod/content-service/pkg/storage PresignedAccess,DirectAccess > mock/mock.go

leeway run components:update-license-header
