/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class LongRunningMigration1675863598550 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_long_running_migration"))) {
            await queryRunner.query(
                `
                    CREATE TABLE IF NOT EXISTS d_b_long_running_migration (
                        name varchar(255) NOT NULL,
                        firstRun timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                        lastRun timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                        completed tinyint(4) NOT NULL DEFAULT '0',
                        _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                        PRIMARY KEY (name)
                    )
                `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
