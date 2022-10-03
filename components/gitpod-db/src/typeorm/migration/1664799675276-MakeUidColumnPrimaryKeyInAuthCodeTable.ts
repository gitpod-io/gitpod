/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "d_b_oauth_auth_code_entry";
const PK_COLUMN = "id";
const UID_COLUMN = "uid";

export class MakeUidColumnPrimaryKeyInAuthCodeTable1664799675276 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE d_b_oauth_auth_code_entry SET uid=(SELECT uuid()) where uid='';`);

        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN ${PK_COLUMN}`);
        await queryRunner.query(
            `ALTER TABLE ${TABLE_NAME} CHANGE ${UID_COLUMN} ${PK_COLUMN} char(36) NOT NULL DEFAULT '';`,
        );
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD PRIMARY KEY (${PK_COLUMN});`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
