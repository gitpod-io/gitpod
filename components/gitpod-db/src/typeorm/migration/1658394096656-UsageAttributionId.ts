/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const TABLE_NAME = "d_b_user";
const COLUMN_NAME = "usageAttributionId";

export class UsageAttributionId1658394096656 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} varchar(60) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
