/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "d_b_oauth_auth_code_entry";
const COLUMN_NAME = "uid";

export class ChangeOauthCodePrimaryKey1664781308555 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} char(36) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE`,
        );
        await queryRunner.query(`UPDATE ${TABLE_NAME} SET ${COLUMN_NAME}=(SELECT uuid());`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
