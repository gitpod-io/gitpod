/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class InstallationAdminTable1642422506330 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_installation_admin"))) {
            await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_installation_admin` (`id` char(128) NOT NULL, `settings` text NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`id`)) ENGINE=InnoDB");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_installation_admin")) {
            await queryRunner.query("DROP TABLE `d_b_installation_admin`");
        }
    }

}
