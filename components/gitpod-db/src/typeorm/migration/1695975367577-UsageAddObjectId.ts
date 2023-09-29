/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

const TABLE_NAME = "d_b_usage";
const COLUMN_NAME = "objectId";
const INDEX_NAME = "ind_kind_objectId";

export class UsageAddObjectId1695975367577 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE \`${TABLE_NAME}\` ADD COLUMN \`${COLUMN_NAME}\` varchar(60) NOT NULL DEFAULT ''`,
            );
        }

        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(
                `ALTER TABLE \`${TABLE_NAME}\` ADD INDEX \`${INDEX_NAME}\` (kind, ${COLUMN_NAME}), ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await indexExists(queryRunner, TABLE_NAME, INDEX_NAME)) {
            await queryRunner.query(`ALTER TABLE \`${TABLE_NAME}\` DROP INDEX \`${INDEX_NAME}\``);
        }

        if (await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME)) {
            await queryRunner.query(`ALTER TABLE \`${TABLE_NAME}\` DROP COLUMN \`${COLUMN_NAME}\``);
        }
    }
}
