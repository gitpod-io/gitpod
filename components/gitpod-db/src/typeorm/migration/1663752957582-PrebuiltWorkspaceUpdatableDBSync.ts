/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

const TABLE_NAME = "d_b_prebuilt_workspace_updatable";
const DELETED_COLUMN_NAME = "deleted";
const MODIFIED_COLUMN_NAME = "_lastModified";
const LAST_MODIFIED_INDEX_NAME = "ind_lastModified";

export class PrebuiltWorkspaceUpdatableDBSync1663752957582 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, DELETED_COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE ${TABLE_NAME} ADD COLUMN \`${DELETED_COLUMN_NAME}\` tinyint(4) NOT NULL DEFAULT '0', ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }

        if (!(await columnExists(queryRunner, TABLE_NAME, MODIFIED_COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${MODIFIED_COLUMN_NAME} timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }

        if (!(await indexExists(queryRunner, TABLE_NAME, LAST_MODIFIED_INDEX_NAME))) {
            await queryRunner.query(
                `CREATE INDEX \`${LAST_MODIFIED_INDEX_NAME}\` ON \`${TABLE_NAME}\` (${MODIFIED_COLUMN_NAME})`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
