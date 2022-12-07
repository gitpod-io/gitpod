/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "d_b_oauth_auth_code_entry";
const COLUMN_NAME = "_lastModified";

export class AddLastModifiedToAuthCodeTable1664894040785 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ALGORITHM=INPLACE, LOCK=NONE `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
