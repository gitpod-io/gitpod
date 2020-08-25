/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class GeneratedLicense1576241423348 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_generated_license` (`id` char(36) NOT NULL, `domain` varchar(255) NOT NULL, `ownerId` char(36) NOT NULL, `creationTime` varchar(255) NOT NULL, `code` text NOT NULL, `type` varchar(12) NOT NULL, PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE UNIQUE INDEX `ind_4489aa4b8a776e7109f40bb088` ON `d_b_generated_license`(`domain`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_generated_license` DROP INDEX `ind_4489aa4b8a776e7109f40bb088`");
        await queryRunner.query("DROP TABLE `d_b_generated_license`");
    }

}
