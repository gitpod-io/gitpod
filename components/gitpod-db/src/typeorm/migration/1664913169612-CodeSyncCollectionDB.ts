/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, tableExists } from "./helper/helper";

export class CodeSyncCollectionDB1664913169612 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_code_sync_collection"))) {
            await queryRunner.query(
                "CREATE TABLE IF NOT EXISTS `d_b_code_sync_collection` (`userId` char(36) NOT NULL, `collection` char(36) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`userId`, `collection`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB",
            );
        }

        if (!(await columnExists(queryRunner, "d_b_code_sync_resource", "collection"))) {
            await queryRunner.query(
                "ALTER TABLE d_b_code_sync_resource ADD COLUMN `collection` char(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000', DROP PRIMARY KEY, ADD PRIMARY KEY (`userId`, `kind`, `rev`, `collection`), ALGORITHM=INPLACE, LOCK=NONE",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
