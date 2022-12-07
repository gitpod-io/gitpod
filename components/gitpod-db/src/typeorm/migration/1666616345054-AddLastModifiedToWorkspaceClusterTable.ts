/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "d_b_workspace_cluster";
const COLUMN_NAME = "_lastModified";
const INDEX_NAME = "ind_lastModified";

export class AddLastModifiedToWorkspaceClusterTable1666616345054 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ALGORITHM=INPLACE, LOCK=NONE `,
        );
        queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (${COLUMN_NAME})`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
