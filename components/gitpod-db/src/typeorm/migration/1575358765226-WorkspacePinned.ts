/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class WorkspacePinned1575358765226 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const connectedDb = queryRunner.connection.options.database;
        const pinnedExists = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${connectedDb}' AND table_name = 'd_b_workspace' AND column_name = 'pinned'`))[0].cnt == 1;
        if (!pinnedExists) {
            await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `pinned` tinyint(4) NOT NULL DEFAULT 0");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `pinned`");
    }

}
