/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class DropLongRunningMigration1684251944953 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_long_running_migration")) {
            await queryRunner.query("DROP TABLE `d_b_long_running_migration`");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
