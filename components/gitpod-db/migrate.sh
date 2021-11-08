#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

# migrate 'migrations' table
yarn --cwd /app/node_modules/@gitpod/gitpod-db run migrate-migrations

/app/typeorm.sh migrations:run