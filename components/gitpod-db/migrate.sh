#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

# perform migration of 'migrations' table
/app/typeorm.sh query "$(sed '/^--/d' < /app/migrate-migrations/0_2_0_up_procedure.sql)"
/app/typeorm.sh query "CALL migrations_0_2_0_up();"
/app/typeorm.sh query "DROP PROCEDURE IF EXISTS migrations_0_2_0_up;"

/app/typeorm.sh migrations:run