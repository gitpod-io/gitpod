/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_blocked_repository";
const newColumn = "blockFreeUsage";

export class AddBlockFreeUsage1713336640910 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, newColumn))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${newColumn} tinyint NOT NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, newColumn)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${newColumn}`);
        }
    }
}
