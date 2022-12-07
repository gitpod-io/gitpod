/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const TABLE_NAME = "d_b_prebuilt_workspace";
const COLUMN_NAME = "statusVersion";

export class PrebuildStatusVersionColumn1649107789640 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE ${TABLE_NAME} ADD COLUMN \`${COLUMN_NAME}\` BIGINT(20) NOT NULL DEFAULT '0'`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
