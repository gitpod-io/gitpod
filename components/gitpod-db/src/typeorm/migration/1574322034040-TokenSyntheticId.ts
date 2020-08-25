/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class TokenSyntheticId1574322034040 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_token_entry DROP PRIMARY KEY");
        await queryRunner.query("ALTER TABLE d_b_token_entry ADD COLUMN uid CHAR(128) NOT NULL");
        await queryRunner.query('UPDATE d_b_token_entry SET uid = CONCAT(authProviderId, "-", authId)');
        await queryRunner.query("ALTER TABLE d_b_token_entry ADD PRIMARY KEY (uid);");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
