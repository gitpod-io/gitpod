/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class WorkspaceSoftDeletion1575358765225 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const connectedDb = queryRunner.connection.options.database;
        const softDeletedExists = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${connectedDb}' AND table_name = 'd_b_workspace' AND column_name = 'softDeleted'`))[0].cnt == 1;
        if (!softDeletedExists) {
            await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `softDeleted` CHAR(4) NULL");
            await queryRunner.query('UPDATE `d_b_workspace` SET `softDeleted` = "user" WHERE userDeleted = 1')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `softDeleted`");
    }

}
