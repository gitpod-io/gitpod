/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class TheiaPlugin1563453262156 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_theia_plugin` (`id` CHAR(36) NOT NULL, `pluginName` varchar(255) NOT NULL, `pluginId` varchar(255) NOT NULL DEFAULT '', `userId` CHAR(36) NOT NULL DEFAULT '', `bucketName` varchar(255) NOT NULL, `path` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '', `state` char(25) NOT NULL, PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE INDEX `ind_plugin_state_hash` ON `d_b_theia_plugin`(`pluginId`, `state`, `hash`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_theia_plugin` DROP INDEX `ind_plugin_state_hash`");
        await queryRunner.query("DROP TABLE `d_b_theia_plugin`");
    }

}
