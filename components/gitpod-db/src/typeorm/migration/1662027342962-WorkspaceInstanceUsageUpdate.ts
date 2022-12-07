/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const TABLE_NAME = "d_b_workspace_instance_usage";
const COLUMN_NAME = "startedAt";

export class WorkspaceInstanceUsageUpdate1662027342962 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME)) {
            await queryRunner.query(
                `ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${COLUMN_NAME} timestamp(6) NULL, ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_workspace_instance_usage` (_lastModified)");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_usage` DROP INDEX `ind_dbsync`");
    }
}
