/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class WorkspaceDeletion1580986547911 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        // Cleanup
        const userDeletedExists = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'd_b_workspace' AND column_name = 'userDeleted'`))[0].cnt == 1;
        if (userDeletedExists) {
            await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `userDeleted`");
        }

        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `softDeletedTime` varchar(255) NOT NULL DEFAULT ''");
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `contentDeletedTime` varchar(255) NOT NULL DEFAULT ''");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `softDeletedTime`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `contentDeletedTime`");
    }

}
