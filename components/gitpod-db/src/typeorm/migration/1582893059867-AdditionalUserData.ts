/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class AdditionalUserData1582893059867 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const connectedDb = queryRunner.connection.options.database;
        const table = `d_b_user`;
        const column = `additionalData`;
        const columnExists = (
            await queryRunner.query(
                `SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema = '${connectedDb}' AND 
                          table_name = '${table}' AND 
                          column_name = '${column}'`))[0].cnt == 1;
        if (!columnExists) {
            await queryRunner.query("ALTER TABLE `d_b_user` ADD `additionalData` text");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_user` DROP `additionalData`");
    }
}
