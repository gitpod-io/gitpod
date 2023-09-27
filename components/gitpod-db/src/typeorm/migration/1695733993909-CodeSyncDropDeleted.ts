/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class CodeSyncDropDeleted1695733993909 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, "d_b_code_sync_resource", "deleted")) {
            await queryRunner.query("ALTER TABLE `d_b_code_sync_resource` DROP COLUMN `deleted`, ALGORITHM=INSTANT");
        }
        if (await columnExists(queryRunner, "d_b_code_sync_collection", "deleted")) {
            await queryRunner.query("ALTER TABLE `d_b_code_sync_collection` DROP COLUMN `deleted`, ALGORITHM=INSTANT");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, "d_b_code_sync_collection", "deleted"))) {
            await queryRunner.query(
                "ALTER TABLE `d_b_code_sync_collection` ADD COLUMN `deleted` tinyint(4) NOT NULL DEFAULT '0', ALGORITHM=INSTANT",
            );
        }
        if (!(await columnExists(queryRunner, "d_b_code_sync_resource", "deleted"))) {
            await queryRunner.query(
                "ALTER TABLE `d_b_code_sync_resource` ADD COLUMN `deleted` tinyint(4) NOT NULL DEFAULT '0', ALGORITHM=INSTANT",
            );
        }
    }
}
