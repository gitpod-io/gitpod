/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class ApiToken1587133424627 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_gitpod_token` (`tokenHash` varchar(255) NOT NULL PRIMARY KEY, `name` varchar(255), `type` int(11) NOT NULL, `userId` char(36) NOT NULL, `scopes` varchar(255) NOT NULL DEFAULT '', created varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT 0, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)) ENGINE=InnoDB");
        await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_gitpod_token` (_lastModified)");
        await queryRunner.query("CREATE INDEX `ind_userId` ON `d_b_gitpod_token` (userId)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_gitpod_token` DROP INDEX `ind_userId`");
        await queryRunner.query("ALTER TABLE `d_b_gitpod_token` DROP INDEX `ind_lastModified`");
        await queryRunner.query("DROP TABLE `d_b_gitpod_token`");
    }

}
