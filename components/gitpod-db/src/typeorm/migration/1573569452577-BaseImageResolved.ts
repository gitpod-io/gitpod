/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class BaseImageResolved1573569452577 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const wsImgColExists = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'd_b_workspace' AND column_name = 'workspaceImage'`))[0].cnt == 1;
        if (wsImgColExists) {
            await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `workspaceImage`");
        }

        const connectedDb = queryRunner.connection.options.database;
        const colExists = (await queryRunner.query(`SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${connectedDb}' AND table_name = 'd_b_workspace' AND column_name = 'baseImageNameResolved'`))[0].cnt == 1;
        if (!colExists) {
            await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `baseImageNameResolved` VARCHAR(255) NOT NULL DEFAULT ''");
        }
        await queryRunner.query(`UPDATE d_b_workspace AS ws SET ws.baseImageNameResolved = ws.imageNameResolved WHERE ws.imageNameResolved NOT LIKE "eu.gcr.io/gitpod-dev/workspace-images%" AND ws.imageNameResolved != '' AND ws.baseImageNameResolved = ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `baseImageNameResolved`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `workspaceImage` VARCHAR(255) NOT NULL DEFAULT ''");
    }

}
