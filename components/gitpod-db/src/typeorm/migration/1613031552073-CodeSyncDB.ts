/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { tableExists } from "./helper/helper";

export class CodeSyncDB1613031552073 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_code_sync_resource` (`userId` char(36) NOT NULL, `kind` char(64) NOT NULL, `rev` char(36) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT 0, `created` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`userId`, `kind`, `rev`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, "d_b_code_sync_resource")) {
            await queryRunner.query("DROP TABLE `d_b_code_sync_resource`");
        }
    }

}
