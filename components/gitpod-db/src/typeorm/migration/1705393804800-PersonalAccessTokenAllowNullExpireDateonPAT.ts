/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const table = "d_b_personal_access_token";

export class PersonalAccessTokenAllowNullExpireDateonPAT1705393804800 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${table} MODIFY expirationTime timestamp(6) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE ${table} CHANGE expirationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`,
        );
    }
}
