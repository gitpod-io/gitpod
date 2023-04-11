/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DropOSSAllowList1680697625457 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_oss_allow_list`");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS `d_b_oss_allow_list` (`identity` char(128) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT 0, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`identity`)) ENGINE=InnoDB",
        );
    }
}
