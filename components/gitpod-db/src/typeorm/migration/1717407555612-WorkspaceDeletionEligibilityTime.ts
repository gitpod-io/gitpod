/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

const TABLE_NAME = "d_b_workspace";
const COLUMN_NAME = "deletionEligibilityTime";
const INDEX_NAME = "ind_deletionEligibilityTime";

export class WorkspaceDeletionEligibilityTime1717407555612 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE \`${TABLE_NAME}\` ADD COLUMN \`${COLUMN_NAME}\` varchar(30) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(
                `ALTER TABLE \`${TABLE_NAME}\` ADD INDEX \`${INDEX_NAME}\` (${COLUMN_NAME}), ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
