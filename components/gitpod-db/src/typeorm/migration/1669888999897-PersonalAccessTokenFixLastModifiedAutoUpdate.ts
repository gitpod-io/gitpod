/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "d_b_personal_access_token";

export class PersonalAccessTokenFixLastModifiedAutoUpdate1669888999897 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} MODIFY expirationTime timestamp(6) NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE ${TABLE_NAME} MODIFY _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) on update CURRENT_TIMESTAMP(6)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
