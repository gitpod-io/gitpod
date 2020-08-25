/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class CheckIdToContextUrl1551696694620 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_prebuilt_workspace_updatable DROP COLUMN checkId, ADD COLUMN contextUrl TEXT NULL");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_prebuilt_workspace_updatable DROP COLUMN contextUrl, ADD COLUMN `checkId` varchar(255) NOT NULL DEFAULT ''");
    }

}
