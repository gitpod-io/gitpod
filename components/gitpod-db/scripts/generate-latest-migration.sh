#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# list all migrations and sort
migrations=$(find ./src/typeorm/migration/*.ts | sort -n | sed 's/\.\/src\/typeorm\/migration\///g' | sed 's/\.ts//g')

# get the latest migration and format its name {ts}-{name} into {name}{ts}
# to align to the generated TypeORM class name which used as migration name
latest_migration=$(echo "$migrations" | tail -n 1 | sed 's/\([0-9]\{13\}\)-\(.*\)/\2\1/g')

if [ -z "$latest_migration" ]; then
    echo "Error: latest_migration should not be empty" 1>&2;
    exit 1
fi

echo "the latest migration is $latest_migration"

echo "$latest_migration" > "$(dirname "$0")/../../service-waiter/cmd/resources/latest-migration.txt"
