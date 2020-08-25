/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class HeadlessToWorkspaceType1568028018949 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `type` CHAR(16) NOT NULL DEFAULT 'regular'");
        await queryRunner.query("UPDATE `d_b_workspace` SET type = 'regular' WHERE headless = 0");
        await queryRunner.query("UPDATE `d_b_workspace` SET type = 'prebuild' WHERE headless = 1");

        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `headless`");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `headless` tinyint(4) NOT NULL DEFAULT 0");
        await queryRunner.query("UPDATE `d_b_workspace` SET headless = 0 WHERE type = 'regular'");
        await queryRunner.query("UPDATE `d_b_workspace` SET headless = 1 WHERE type = 'prebuild' OR type = 'probe'");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `type`");
    }

}
