/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { tableExists } from "./helper/helper";

export class AuthProviderEntry1593180029504 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!(await tableExists(queryRunner, "d_b_auth_provider_entry"))) {
            await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_auth_provider_entry` (`id` varchar(255) NOT NULL, `ownerId` char(36) NOT NULL, `status` varchar(25) NOT NULL, `host` varchar(255) NOT NULL, `type` varchar(100) NOT NULL, oauth text NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT 0, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
            await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_auth_provider_entry` (_lastModified)");
            await queryRunner.query("CREATE INDEX `ind_ownerId` ON `d_b_auth_provider_entry` (ownerId)");
            await queryRunner.query("CREATE INDEX `ind_host` ON `d_b_auth_provider_entry` (host)");
            await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_auth_provider_entry` (_lastModified)");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, "d_b_auth_provider_entry")) {
            await queryRunner.query("ALTER TABLE `d_b_auth_provider_entry` DROP INDEX `ind_dbsync`");
            await queryRunner.query("ALTER TABLE `d_b_auth_provider_entry` DROP INDEX `ind_host`");
            await queryRunner.query("ALTER TABLE `d_b_auth_provider_entry` DROP INDEX `ind_ownerId`");
            await queryRunner.query("ALTER TABLE `d_b_auth_provider_entry` DROP INDEX `ind_lastModified`");
            await queryRunner.query("DROP TABLE `d_b_auth_provider_entry`");
        }
    }

}
